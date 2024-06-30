import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { exec } from "child_process";
import { TRPCError } from "@trpc/server";
import { jobParameters, jobs } from "@/server/db/schema";
import { Server } from "@tus/server";
import { FileStore } from "@tus/file-store";
import path from "path";
import { env } from "@/env";
import fs from "fs";
import AdmZip from "adm-zip";

const server = new Server({
  path: path.join(env.USER_DIR, "unclaimed"),
  datastore: new FileStore({
    directory: path.join(env.USER_DIR, "unclaimed"),
  }),
});
export const jobsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        jobTypeId: z.string().uuid(),
        fileId: z.string().uuid().optional(),
        parameters: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { name, jobTypeId, fileId, parameters } = input;
      //If a fileId is provided, we ensure that it is a valid file ID that belongs to the user
      if (!!fileId) {
        const file = await ctx.db.query.files.findFirst({
          where: (files, { eq }) => eq(files.id, input.fileId!),
        });

        if (!file || file.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid FileId provided",
          });
        }
      }

      //Check if the user has access to the job type
      const jobType = await ctx.db.query.jobTypes.findFirst({
        where: (jobTypes, { eq }) => eq(jobTypes.id, input.jobTypeId),
      });

      //Throw bad request if job type doesn't exist
      if (!jobType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Job Type",
        });
      }

      //Check if they created the job type (or are a global admin)
      if (
        jobType.createdBy !== ctx.session.user.id &&
        ctx.session.user.role !== 1
      ) {
        //If not, check if the job type is shared with them or one of their orgs
        const requestorOrgs = await ctx.db.query.organisationMembers.findMany({
          where: (organisationMembers, { eq }) =>
            eq(organisationMembers.userId, ctx.session.user.id),
        });

        const _jt = await ctx.db.query.sharedJobTypes.findFirst({
          where: (sharedJobTypes, { eq, and, or, inArray }) =>
            and(
              eq(sharedJobTypes.jobTypeId, jobType.id),
              or(
                inArray(
                  sharedJobTypes.organisationId,
                  requestorOrgs.map((org) => org.organisationId),
                ),
                eq(sharedJobTypes.userId, ctx.session.user.id),
              ),
            ),
        });

        //If it is not shared, we throw unauthorized
        if (!_jt) throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      //Start a transaction
      return await ctx.db.transaction(async (tx) => {
        //======================================================================//
        //========================Database Record Creation======================//
        //======================================================================//
        //Create the database record
        const newJob = await tx
          .insert(jobs)
          .values({
            name,
            jobTypeId,
            fileId,
            createdBy: ctx.session.user.id,
          })
          .returning({ id: jobs.id });

        const newJobId = newJob[0]?.id;
        //Rollback if any issues
        if (!newJobId) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        //======================================================================//
        //==========================Parameter Setup=============================//
        //======================================================================//
        //Add the parameters
        if (parameters) {
          try {
            await tx.insert(jobParameters).values(
              parameters.map((param) => ({
                ...param,
                jobId: newJobId,
              })),
            );
          } catch (e) {
            //Rollback if any issues
            tx.rollback();
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: e });
          }
        }

        try {
          //======================================================================//
          //=============================File Setup===============================//
          //======================================================================//
          //Ensure all the required directories exist
          fs.mkdirSync(
            path.join(env.USER_DIR, ctx.session.user.id, "input", newJobId),
            { recursive: true },
          );
          fs.mkdirSync(
            path.join(env.USER_DIR, ctx.session.user.id, "output", newJobId),
            { recursive: true },
          );
          fs.mkdirSync(
            path.join(env.USER_DIR, ctx.session.user.id, "script", newJobId),
            { recursive: true },
          );

          //Move the files into the correct folder if a fileId is provided
          if (fileId) {
            const inputDir = path.join(
              env.USER_DIR,
              ctx.session.user.id,
              "input",
              newJobId,
            );
            const filePath = path.join(env.USER_DIR, "unclaimed");
            //Grab a list of all files in the unclaimed directory and move any files that start with the fileId to the input directory
            const files = fs.readdirSync(filePath);
            files.forEach((file) => {
              if (file.startsWith(fileId)) {
                fs.renameSync(
                  path.join(filePath, file),
                  path.join(inputDir, file),
                );
              }
            });
          }
        } catch (e) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: e });
        }

        //======================================================================//
        //==========================Script Generation===========================//
        //======================================================================//

        //Grab the original script template
        const jobTypeScript = jobType.script;
        //Swap out /r/n with /n
        let script = jobTypeScript.replace("\r\n", "\n");

        //Add in the Slurm Directives
        //Job Name Directive                                    //Job Output Directive                                                             //If array job we append the array index to the filename
        script = `#!/bin/bash\n#SBATCH --job-name=${input.name}\n#SBATCH --output=${path.join(env.USER_DIR, ctx.session.user.id, "output", newJobId, jobType.arrayJob ? "slurmout-%a.txt" : "slurmout.txt")}`;

        if (jobType.arrayJob) {
          //We count the number of ZIP folders in the input directory
          //This tells us how many array runs we need to do
          const zipFolders = fs
            .readdirSync(
              path.join(env.USER_DIR, ctx.session.user.id, "input", newJobId),
            )
            .filter((file) => file.endsWith(".zip"));
          const numZipFolders = zipFolders.length;

          //If it is an array job, we need to add the array index to the filename
          script += `\n#SBATCH --array=1-${numZipFolders}\n\n`;

          //Each zip folder is called [fileId]-[number].zip, we extract the files in the zip folder into a folder called [number]
          zipFolders.forEach((zipFolder) => {
            const zip = new AdmZip(
              path.join(env.USER_DIR, "unclaimed", zipFolder),
            );
            zip.extractAllTo(
              path.join(
                env.USER_DIR,
                ctx.session.user.id,
                "input",
                newJobId,
                zipFolder.split("-")[1]!,
              ),
              true,
            );
          });
        }

        
      });
    }),
});
