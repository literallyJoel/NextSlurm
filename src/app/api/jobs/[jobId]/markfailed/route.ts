import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { NextApiRequest } from "next";

export async function POST(
  req: NextApiRequest,
  { params }: { params: { jobId: string } },
) {
  const { jobId } = params;

  //A random auth code is generated when the job is created
  const providedAuthCode = req.headers.authorization;
  //We grab the code from the database and compare it to the one provided
  const actualAuthCode = await db.query.jobs.findFirst({
    where: (jobs, { eq }) => eq(jobs.id, jobId),
    columns: {
      authCode: true,
    },
  });

  //If it doesn't match, we know it's not coming from the automated script
  if (providedAuthCode !== actualAuthCode?.authCode) {
    return new Response("Unauthorized", { status: 401 });
  }

  await db
    .update(jobs)
    .set({ status: "failed", endTime: new Date() })
    .where(eq(jobs.id, jobId))
    .execute()
    .catch(() => {
      return new Response("Internal Server Error", { status: 500 });
    })
    .then(() => {
      return new Response(`Job with Id ${jobId} marked as failed`, {
        status: 200,
      });
    });
}
