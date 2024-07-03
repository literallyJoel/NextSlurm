import amqp from "amqplib";
import { exec } from "child_process";
import fetch from "node-fetch";

async function consumeJobs() {
  const amqpHost = process.env.AMQP_HOST || "amqp://localhost"; // Default if not set
  const serverUrl = process.env.SERVER_URL || "http://localhost:3000"; // Default if not set
  try {
    const connection = await amqp.connect(amqpHost);
    const channel = await connection.createChannel();
    process.once("SIGINT", async () => {
      console.log(" [x] Exiting...");
      await channel.close();
      await connection.close();
    });
    await channel.assertQueue("slurmJob", { durable: true });
    await channel.consume("slurmJob", async (msg) => {
      if (!msg) return;

      const jobData = JSON.parse(msg.content.toString()) as {
        jobId: string;
        scriptPath: string;
        directories: {
          input: string;
          output: string;
          script: string;
        };
        authCode: string;
      };

      console.log(" [x] Received %s", jobData);

      try {
        const execAsync = (command: string) => {
          return new Promise<string>((resolve, reject) => {
            exec(command, (err, stdout) => {
              if (err) reject(err);
              resolve(stdout);
            });
          });
        };

        const slurmId = (await execAsync(`sbatch ${jobData.scriptPath}`))
          .split(" ")
          .pop();

        if (!slurmId) throw new Error("Failed to retrieve Slurm ID");

        const submitDependentJob = async (dependency: string) => {
          await execAsync(
            `sbatch --dependency=${dependency}:${slurmId} --kill-on-invalid-dep=yes --wrap="curl -X POST -H 'Authorization: ${jobData.authCode}' '${serverUrl}/api/jobs/${jobData.jobId}/mark${dependency === "afterok" ? "complete" : "failed"}'"`,
          );
        };

        await Promise.all([
          submitDependentJob("afterok"),
          submitDependentJob("afternotok"),
        ]);
      } catch (e) {
        console.error("Error scheduling job:", e);
        // Mark job as failed on error
        await fetch(`${serverUrl}/api/jobs/${jobData.jobId}/markfailed`, {
          method: "POST",
          headers: { Authorization: jobData.authCode },
        });
      } finally {
        channel.ack(msg);
      }
    });
  } catch (e) {
    console.error("Error consuming jobs:", e);
  }
}

consumeJobs();
