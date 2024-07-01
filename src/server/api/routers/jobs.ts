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
          where: (files, { eq, and }) =>
            and(eq(files.id, fileId), eq(files.userId, ctx.session.user.id)),
        });

        if (!file) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid FileId provided",
          });
        }
      }

      //Ensure the user has access to the selected job type
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
        //Create the initial database record
        const job = (
          await tx
            .insert(jobs)
            .values({
              name,
              jobTypeId,
              fileId,
              createdBy: ctx.session.user.id,
            })
            .returning({
              id: jobs.id,
              name: jobs.createdBy,
              jobTypeId: jobs.jobTypeId,
              fileId: jobs.fileId,
              createdBy: jobs.createdBy,
            })
        )[0];

        //Rollback if any issues
        if (!job) {
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Job. Try",
          });
        }

        //Create an object with the users directores
        const directories = {
          input: path.join(env.USER_DIR, ctx.session.user.id, "input", job.id),
          output: path.join(
            env.USER_DIR,
            ctx.session.user.id,
            "output",
            job.id,
          ),
          script: path.join(
            env.USER_DIR,
            ctx.session.user.id,
            "script",
            job.id,
          ),
          unclaimed: path.join(env.USER_DIR, "unclaimed"),
        };

        //Create the directories if they don't exist
        fs.mkdirSync(directories.input, { recursive: true });
        fs.mkdirSync(directories.output, { recursive: true });
        fs.mkdirSync(directories.script, { recursive: true });

        //Used to store the number of files uploaded for an array job
        let numZipFiles: number | undefined;
        //Check if the job accepts file uploads
        if (jobType.hasFileUpload) {
          //If it does, we check if it's an array job. (All array jobs have file uploads).
          if (jobType.arrayJob) {
            /*
            If it's an array job, the user will have uploaded multiple ZIP files.
            They'll follow the naming convention [fileId]-[arrayIndex].zip
            We need to extract the files from each ZIP file in to an [arrayIndex] folder in the
            input directory for this job.
            */
            //Find the ZIP files in the unclaimed directory
            const zipFiles = fs
              .readdirSync(directories.unclaimed)
              .filter((file) => {
                return file.startsWith(fileId!);
              });
            numZipFiles = zipFiles.length;
            //For each ZIP File, we extract the files into the input directory
            zipFiles.forEach((zipFile) => {
              const zip = new AdmZip(path.join(directories.unclaimed, zipFile));
              fs.mkdirSync(
                path.join(directories.input, zipFile.split("-")[1]!),
              );
              zip.extractAllTo(
                path.join(directories.input, zipFile.split("-")[1]!),
              );
            });
          } else {
            //If it's not an array job, it'll either be a single file, or a single ZIP file.
            //If it's a single file, we move it to the input directory
            const file = fs.readdirSync(directories.unclaimed).find((file) => {
              return file.startsWith(fileId!);
            });

            if (!file) {
              tx.rollback();
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Failed to find uploaded file",
              });
            }

            if (!file.endsWith(".zip")) {
              fs.renameSync(
                path.join(directories.unclaimed, file),
                path.join(directories.input, file),
              );
            } else {
              //If it's a zip file, we extract the files into the input directory
              const zip = new AdmZip(path.join(directories.unclaimed, file));
              zip.extractAllTo(directories.input);
            }
          }
        }

        //Grab the original script template
        let script = jobType.script;
        //Swap out /r/n with /n
        script = script.replace("\r\n", "\n");
        //Replace the parameter placeholders with the provided parameters
        parameters?.forEach((param) => {
          script = script.replace(`{{${param.key}}}`, param.value);
        });

        // //Add the Slurm Directives
        // script = `#!/bin/bash\n#SBATCH --job-name=${job.name}\n#SBATCH --output=${path.join(directories.output, jobType.arrayJob ? "slurmout-%a.txt" : "slurmout.txt")}`;

        //Check for any variables that follow $file[number]
        const fileVariables = Array.from(new Set(script.match(/\$file\d+/g)));

        fileVariables.forEach((fileVariable) => {
          const fVar = fileVariable.split("$")[1]!;
          const fileName = fs
            .readdirSync(directories.input)
            .find((file) => file.startsWith(fVar));
          script = `${fVar}="${directories.input}/${fileName}"`;
        });

        //Check for any variables that follow $arrayfile[number]
        const arrayFileVariables = Array.from(
          new Set(script.match(/\$arrayfile\d+/g)),
        );
      });
    }),
});
