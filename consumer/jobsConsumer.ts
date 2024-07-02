import amqp from "amqplib/callback_api";
import { exec } from "child_process";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";

async function consumeJobs() {
  const amqpHost = process.env.AMQP_HOST || "amqp://localhost"; // Default if not set
  const serverUrl = process.env.SERVER_URL || "http://localhost:3000"; // Default if not set

  try {
    amqp.connect(amqpHost, (err, connection) => {
      if (err) throw err;

      connection.createChannel((err, channel) => {
        if (err) throw err;

        channel.assertQueue("slurmJob", { durable: true });

        channel.consume("slurmJob", async (msg) => {
          if (!msg) return;

          const jobData = JSON.parse(msg.content.toString()) as {
            jobId: string;
            script: string;
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

            const scriptPath = path.join(
              jobData.directories.script,
              "script.sh",
            );

            //Write the script to the script directory
            fs.writeFileSync(scriptPath, jobData.script);

            const slurmId = (await execAsync(`sbatch ${scriptPath}`))
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
            channel.ack(msg); // Acknowledge message after processing (success or failure)
          }
        });

        console.log(
          " [*] Waiting for messages in %s. To exit press CTRL+C",
          "slurmJob",
        );

        //Gracefully close the connection on process exit
        process.once("SIGINT", () => {
          channel.close((err) => {
            if (err) throw err;
          });
          connection.close();
        });
      });
    });
  } catch (error) {
    console.error("Error consuming jobs:", error);
  }
}

consumeJobs();
