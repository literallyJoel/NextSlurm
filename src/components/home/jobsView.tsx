import { getServerAuthSession } from "@/server/auth";
import { api } from "@/trpc/server";
import Link from "next/link";

export default async function JobsView({
  filter,
}: {
  filter: "running" | "completed" | "failed" | "queued";
}) {
  const jobs = await api.jobs.getAll({ filter });
  const session = await getServerAuthSession();
  const colour =
    filter === "completed"
      ? "emerald"
      : filter === "failed"
        ? "red"
        : filter === "queued"
          ? "orange"
          : "sky";
  return (
    <div className="flex min-h-full w-full flex-col gap-4 rounded-lg bg-slate-800 p-6">
      <div className="flex flex-row items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full bg-${colour}-500  box-shadow-lg shadow-${colour}-600`}
        />
        {filter.charAt(0).toUpperCase() + filter.slice(1)} Jobs
      </div>
      {jobs.map((job) => (
        <Link
          href={`/jobs?selected=${job.id}`}
          key={job.id}
          className="flex flex-col gap-2 rounded-lg bg-slate-700 p-2 px-8 hover:bg-slate-700/80"
        >
          <div className="flew-row flex justify-between">
            <div>{job.name}</div>

            <div className="text-sm text-slate-300">
              Created by{" "}
              {job.createdBy?.id === session?.user.id
                ? "You"
                : job.createdBy?.name}
            </div>
          </div>

          <div className="flex flex-row justify-between">
            <div className="text-sm text-slate-300">{job.jobType?.name}</div>
            <div className="text-sm text-slate-300">
              {filter === "running" || filter === "queued"
                ? "Running Since: " + job.startTime?.toLocaleString()
                : `${filter.charAt(0).toUpperCase() + filter.slice(1)} ${job.endTime?.toLocaleString()}`}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
