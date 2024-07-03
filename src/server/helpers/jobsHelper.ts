import { z } from "zod";
import { db } from "../db";
import logger from "@/logging/logger";
import path from "path";
import { env } from "@/env";
import fs from "fs";
import AdmZip from "adm-zip";
import { TRPCError } from "@trpc/server";
import amqp from "amqplib";

export const validateFileId = z
  .function()
  .args(
    z.object({
      fileId: z.string().uuid().optional(),
      userId: z.string().uuid(),
    }),
  )
  .returns(z.promise(z.boolean()))
  .implement(async ({ fileId, userId }) => {
    if (!fileId) return true;
    const file = await db.query.files.findFirst({
      where: (files, { eq, and }) =>
        and(eq(files.id, fileId), eq(files.userId, userId)),
    });

    logger.info(
      `Validated file ID: ${fileId} for user: ${userId}. Result: ${!!file}`,
    );
    return !!file;
  });

export const validateJobType = z
  .function()
  .args(
    z.object({
      jobTypeId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.number().min(0).max(1),
    }),
  )
  .returns(
    z.promise(
      z.literal(false).or(
        z
          .object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string(),
            script: z.string(),
            createdBy: z.string().uuid(),
            hasFileUpload: z.boolean(),
            arrayJob: z.boolean(),
          })
          .or(z.undefined()),
      ),
    ),
  )
  .implement(async ({ jobTypeId, userId, role }) => {
    const jobType = await db.query.jobTypes.findFirst({
      where: (jobTypes, { eq }) => eq(jobTypes.id, jobTypeId),
    });

    if (!jobType) {
      logger.warn(`Job type not found: ${jobTypeId}`);
      return undefined;
    }

    if (jobType.createdBy !== userId && role !== 1) {
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
      if (!_jt) {
        logger.warn(`User ${userId} not authorized for job type ${jobTypeId}`);
        return false;
      }
    }

    logger.info(`Job type ${jobTypeId} validated for user ${userId}`);
    return jobType;
  });

export const setupDirectories = z
  .function()
  .args(z.object({ jobId: z.string().uuid(), userId: z.string().uuid() }))
  .returns(
    z.promise(
      z.object({
        input: z.string(),
        output: z.string(),
        script: z.string(),
        unclaimed: z.string(),
      }),
    ),
  )
  .implement(async ({ jobId, userId }) => {
    const directories = {
      input: path.join(env.USER_DIR, userId, "input", jobId),
      output: path.join(env.USER_DIR, userId, "output", jobId),
      script: path.join(env.USER_DIR, userId, "script", jobId),
      unclaimed: path.join(env.USER_DIR, "unclaimed"),
    };

    fs.mkdirSync(directories.input, { recursive: true });
    fs.mkdirSync(directories.output, { recursive: true });
    fs.mkdirSync(directories.script, { recursive: true });

    logger.info(`Directories set up for job ${jobId}, user ${userId}`);
    return directories;
  });

export const handleFiles = z
  .function()
  .args(
    z.object({
      hasFileUpload: z.boolean(),
      arrayJob: z.boolean(),
      directories: z.object({
        input: z.string(),
        output: z.string(),
        script: z.string(),
        unclaimed: z.string(),
        fileId: z.string().optional(),
      }),
    }),
  )
  .returns(z.promise(z.boolean().or(z.unknown())))
  .implement(async ({ hasFileUpload, arrayJob, directories }) => {
    try {
      if (!hasFileUpload) return true;

      if (arrayJob) {
        const zipFiles = fs
          .readdirSync(directories.unclaimed)
          .filter((file) => file.startsWith(directories.fileId!));

        logger.info(`Processing ${zipFiles.length} zip files for array job`);

        zipFiles.forEach((zipFile) => {
          const zip = new AdmZip(path.join(directories.unclaimed, zipFile));
          fs.mkdirSync(
            path.join(directories.input, zipFile.split("-")[1] ?? "0"),
            { recursive: true },
          );
          zip.extractAllTo(
            path.join(directories.input, zipFile.split("-")[1] ?? "0"),
          );
          logger.info(`Extracted zip file: ${zipFile}`);
        });
      } else {
        const file = fs
          .readdirSync(directories.unclaimed)
          .find((file) => file.startsWith(directories.fileId!));
        if (!file) {
          logger.error(`File not found for fileId: ${directories.fileId}`);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        if (file.endsWith(".zip")) {
          const zip = new AdmZip(path.join(directories.unclaimed, file));
          zip.extractAllTo(directories.input);
          logger.info(`Extracted zip file: ${file}`);
        } else {
          fs.renameSync(
            path.join(directories.unclaimed, file),
            path.join(directories.input, file),
          );
          logger.info(`Moved file: ${file}`);
        }
      }

      return true;
    } catch (e) {
      logger.error("Error handling files", { cause: e });
      return e;
    }
  });

export const templateScript = z
  .function()
  .args(
    z.object({
      script: z.string(),
      parameters: z
        .array(z.object({ value: z.string(), key: z.string() }))
        .optional(),
      arrayJob: z.boolean(),
      directories: z.object({
        input: z.string(),
        output: z.string(),
        script: z.string(),
        unclaimed: z.string(),
      }),
      job: z.object({ id: z.string(), name: z.string(), authCode: z.string() }),
    }),
  )
  .returns(z.promise(z.string()))
  .implement(async ({ script, parameters, arrayJob, directories, job }) => {
    script = script.replace("\r\n", "\n");
    parameters?.forEach((param) => {
      script = script.replace(`{{${param.key}}}`, param.value);
    });

    const fileVariables = Array.from(new Set(script.match(/\$file\d+/g)));
    const outputVariables = Array.from(new Set(script.match(/\$out\d+/g)));

    fileVariables.forEach((fileVariable) => {
      const fVar = fileVariable.split("$")[1]!;
      script =
        `${fVar}=$(find ${arrayJob ? `"${directories.input}/${"${SLURM_ARRAY_TASK_ID}"}"` : directories.input} -type f -name "${fVar}"* -print -quit)\n` +
        script;
    });

    outputVariables.forEach((outputVariable) => {
      const oVar = outputVariable.split("$")[1]!;
      script = `${oVar}=${directories.output}/${oVar}` + script;
    });

    script =
      `curl -s -X post -H 'authorization: ${job.authCode}' '${env.SERVER_URL}/api/jobs/${job.id}/markrunning'` +
      script;

    script =
      `#!/bin/bash\n#SBATCH --job-name=${job.name}\n#SBATCH --output=${path.join(directories.output, arrayJob ? "slurmout-%a.txt" : "slurmout.txt")}\n` +
      script;

    const scriptPath = path.join(directories.script, "script.sh");
    fs.writeFileSync(scriptPath, script);

    logger.info(`Script templated and saved for job ${job.id}`);
    return scriptPath;
  });

export const connectToAmqp = async () => {
  try {
    const connection = await amqp.connect(env.AMQP_HOST);
    const channel = await connection.createChannel();
    await channel.assertQueue("slurmJob", { durable: true });
    logger.info("Connected to AMQP");
    return { connection, channel };
  } catch (e) {
    logger.error("Failed to connect to AMQP", { cause: e });
    throw e;
  }
};
