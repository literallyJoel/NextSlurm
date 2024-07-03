  import { z } from "zod";
  import { createTRPCRouter, protectedProcedure } from "../trpc";
  import { TRPCError } from "@trpc/server";
  import { jobs } from "@/server/db/schema";
  import amqp from "amqplib";
  import path from "path";
  import { env } from "@/env";
  import fs from "fs";
  import AdmZip from "adm-zip";
  import { db } from "@/server/db";

  const validateFileId = async (fileId: string | undefined, userId: string) => {
    if (!fileId) return true;
    const file = await db.query.files.findFirst({
      where: (files, { eq, and }) =>
        and(eq(files.id, fileId), eq(files.userId, userId)),
    });

    return !!file;
  };

  const validateJobType = async (
    jobTypeId: string,
    userId: string,
    role: number,
  ) => {
    const jobType = await db.query.jobTypes.findFirst({
      where: (jobTypes, { eq }) => eq(jobTypes.id, jobTypeId),
    });

    if (!jobType) return undefined;

    //Check if the job type is created by the user (or they're a global admin)
    if (jobType.createdBy !== userId && role !== 1) {
      //If not, check if the job type is shared with them or one of their orgs
      const requestorOrgs = await db.query.organisationMembers.findMany({
        where: (organisationMembers, { eq }) =>
          eq(organisationMembers.userId, userId),
      });

      const _jt = await db.query.sharedJobTypes.findFirst({
        where: (sharedJobTypes, { eq, and, or, inArray }) =>
          and(
            eq(sharedJobTypes.jobTypeId, jobType.id),
            or(
              inArray(
                sharedJobTypes.organisationId,
                requestorOrgs.map((org) => org.organisationId),
              ),
              eq(sharedJobTypes.userId, userId),
            ),
          ),
      });
      if (!_jt) return false;
    }

    return jobType;
  };

  function setupDirectories(jobId: string, userId: string) {
    const directories = {
      input: path.join(env.USER_DIR, userId, "input", jobId),
      output: path.join(env.USER_DIR, userId, "output", jobId),
      script: path.join(env.USER_DIR, userId, "script", jobId),
      unclaimed: path.join(env.USER_DIR, "unclaimed"),
    };

    fs.mkdirSync(directories.input, { recursive: true });
    fs.mkdirSync(directories.output, { recursive: true });
    fs.mkdirSync(directories.script, { recursive: true });

    return directories;
  }

  function handleFiles(
    hasFileUpload: boolean,
    arrayJob: boolean,
    directories: {
      input: string;
      output: string;
      script: string;
      unclaimed: string;
      fileId?: string;
    },
  ) {
    try {
      //Check if the job has file uploads
      if (!hasFileUpload) return true;

      //If it does, we check if it's an array job.
      if (arrayJob) {
        /*
      If it is, we know there's going to be one or several zip files uploaded
      We need to extract the files from each ZIP file in to an [arrayIndex] folder in the
      input directory for this job.
      */

        //Get the file in the unclaimed directory that start with the fileId
        const zipFiles = fs
          .readdirSync(directories.unclaimed)
          .filter((file) => file.startsWith(directories.fileId!));

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
          .find((file) => file.startsWith(directories.fileId!));
        if (!file) {
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

      return true;
    } catch (e) {
      return e;
    }
  }

  function templateScript(
    script: string,
    parameters: { value: string; key: string }[] | undefined,
    arrayJob: boolean,
    directories: {
      input: string;
      output: string;
      script: string;
      unclaimed: string;
    },
    job: { id: string; name: string; authCode: string },
  ) {
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
        `${fVar}=$(find ${arrayJob ? `"${directories.input}/${"${SLURM_ARRAY_TASK_ID}"}"` : directories.input} -type f -name "${fVar}"* -print -quit)\n` +
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
      `#!/bin/bash\n#SBATCH --job-name=${job.name}\n#SBATCH --output=${path.join(directories.output, arrayJob ? "slurmout-%a.txt" : "slurmout.txt")}\n` +
      script;

    const scriptPath = path.join(directories.script, "script.sh");
    fs.writeFileSync(scriptPath, script);

    return scriptPath;
  }

  const connecToAmqp = async () => {
    try {
      const connection = await amqp.connect(env.AMQP_HOST);
      const channel = await connection.createChannel();
      await channel.assertQueue("slurmJob", { durable: true });
      return { connection, channel };
    } catch (e) {
      console.error(e);
      throw e;
    }
  };
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
        if (!(await validateFileId(fileId, ctx.session.user.id))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid FileId provided",
          });
        }

        //Ensure the user has access to the selected job type
        const jobType = await validateJobType(
          input.jobTypeId,
          ctx.session.user.id,
          ctx.session.user.role,
        );

        switch (jobType) {
          case false:
            throw new TRPCError({ code: "UNAUTHORIZED" });
          case undefined:
            throw new TRPCError({
              code: "BAD_REQUEST",
            });
          default:
            break;
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
          const directories = setupDirectories(job.id, ctx.session.user.id);

          const handleFilesResult = handleFiles(
            jobType.hasFileUpload,
            jobType.arrayJob,
            directories,
          );

          if (handleFilesResult instanceof Error) {
            tx.rollback();
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to handle files. Try again later.",
              cause: handleFilesResult,
            });
          }

          const scriptPath = templateScript(
            jobType.script,
            parameters,
            jobType.arrayJob,
            directories,
            job,
          );

          try {
            const jobData = {
              jobId: job.id,
              scriptPath: scriptPath,
              directories,
              authCode: job.authCode,
            };

            const { connection, channel } = await connecToAmqp();
            channel.sendToQueue(
              "slurmJob",
              Buffer.from(JSON.stringify(jobData)),
              {
                persistent: true,
              },
            );

            console.log(" [x] Sent %s", jobData);
            setTimeout(async () => {
              await connection.close();
            }, 500);
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
