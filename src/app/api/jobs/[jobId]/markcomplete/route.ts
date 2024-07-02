import { db } from "@/server/db";
import { jobs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { NextApiRequest } from "next";
import { headers } from "next/headers";

export async function POST(
  req: NextApiRequest,
  { params }: { params: { jobId: string } },
) {
  const { jobId } = params;

  //A random auth code is generated when the job is created
  const providedAuthCode = headers().get("authorization");
  //We grab the code from the database and compare it to the one provided
  const actualAuthCode = await db.query.jobs.findFirst({
    where: (jobs, { eq }) => eq(jobs.id, jobId),
    columns: {
      authCode: true,
    },
  });

  console.log("Provided Auth Code:", providedAuthCode);
  console.log("Actual Auth Code:", actualAuthCode?.authCode);

  //If it doesn't match, we know it's not coming from the automated script
  if (providedAuthCode !== actualAuthCode?.authCode) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await db
      .update(jobs)
      .set({ status: "complete", endTime: new Date() })
      .where(eq(jobs.id, jobId))
      .execute();
  } catch (e) {
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response(`Job with Id ${jobId} marked as complete`, {
    status: 200,
  });
}
