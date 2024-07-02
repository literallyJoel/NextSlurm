import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { exec } from "child_process";
import { TRPCError } from "@trpc/server";
import { jobs } from "@/server/db/schema";
import amqp from "amqplib/callback_api";
import path from "path";
import { env } from "@/env";
import fs from "fs";
import AdmZip from "adm-zip";
import { eq } from "drizzle-orm";
import { v4 } from "uuid";

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
        //Create the initial database record so we can retrieve the ID
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
              authCode: jobs.authCode,
            })
        )[0];

        //Rollback if any issues
        if (!job) {
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Job. Try again later.",
          });
        }

        //Setup the user directories
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

        //Check if the job has file uploads
        if (jobType.hasFileUpload) {
          //If it does, we check if it's an array job.
          if (jobType.arrayJob) {
            /*
            If it is, we know there's going to be one or several zip files uploaded
            We need to extract the files from each ZIP file in to an [arrayIndex] folder in the
            input directory for this job.
            */

            //Get the file in the unclaimed directory that start with the fileId
            const zipFiles = fs
              .readdirSync(directories.unclaimed)
              .filter((file) => file.startsWith(fileId!));

            //For each zip file, we extract the files into the input directory
            zipFiles.forEach((zipFile) => {
              const zip = new AdmZip(path.join(directories.unclaimed, zipFile));
              fs.mkdirSync(
                //We grab the array index from the file name to create the directory
                path.join(directories.input, zipFile.split("-")[1] ?? "0"),
                { recursive: true },
              );
              zip.extractAllTo(
                path.join(directories.input, zipFile.split("-")[1] ?? "0"),
              );
            });
          } else {
            //If it's not an array job, it'll either be a single file, or a single ZIP file.

            //Grab the file
            const file = fs
              .readdirSync(directories.unclaimed)
              .find((file) => file.startsWith(fileId!));
            if (!file) {
              tx.rollback();
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
              });
            }

            //Check if it's a zip file, if it is, we extract the files into the input directory
            if (file.endsWith(".zip")) {
              const zip = new AdmZip(path.join(directories.unclaimed, file));
              zip.extractAllTo(directories.input);
            } else {
              //If it's a single file, we move it to the input directory
              fs.renameSync(
                path.join(directories.unclaimed, file),
                path.join(directories.input, file),
              );
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

        //Check for any file bash variables
        const fileVariables = Array.from(new Set(script.match(/\$file\d+/g)));

        fileVariables.forEach((fileVariable) => {
          const fVar = fileVariable.split("$")[1]!;
          //This assigns the file{x} variable to the file in the input directory
          //There is only ever one "file0" in each input directory, so the first result is always the correct file
          //It means we don't need to care about the extension of the file
          script =
            `${fVar}=$(find ${jobType.arrayJob ? `"${directories.input}/${"${SLURM_ARRAY_TASK_ID}"}"` : directories.input} -type f -name "${fVar}"* -print -quit)\n` +
            script;
        });

        //Check for any output bash variables
        const outputVariables = Array.from(new Set(script.match(/\$out\d+/g)));
        outputVariables.forEach((outputVariable) => {
          const oVar = outputVariable.split("$")[1]!;
          script = `${oVar}=${directories.output}/${oVar}` + script;
        });

        //Add the mark running command
        script =
          `curl -s -X post -H 'authorization: ${job.authCode}' '${env.SERVER_URL}/api/jobs/${job.id}/markrunning'` +
          script;

        //Add the Slurm Directives
        script =
          `#!/bin/bash\n#SBATCH --job-name=${job.name}\n#SBATCH --output=${path.join(directories.output, jobType.arrayJob ? "slurmout-%a.txt" : "slurmout.txt")}\n` +
          script;

        console.log(script);

        //Write the script to the script directory
        fs.writeFileSync(path.join(directories.script, "script.sh"), script);

        try {
          const jobData = {
            jobId: job.id,
            scriptPath: path.join(directories.script, "script.sh"),
            directories,
            authCode: job.authCode,
          };

          amqp.connect(env.AMQP_HOST, (err0, connnection) => {
            if (err0) {
              throw err0;
            }

            connnection.createChannel((err1, channel) => {
              if (err1) {
                throw err1;
              }

              const queue = "slurmJob";
              channel.assertQueue(queue, { durable: true });

              channel.sendToQueue(queue, Buffer.from(JSON.stringify(jobData)), {
                persistent: true,
              });
              console.log(" [x] Sent %s", jobData);

              setTimeout(() => {
                connnection.close();
              }, 500);
            });
          });
        } catch (e) {
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to queue job. Please try again later.",
            cause: e,
          });
        }
      });
    }),
});
