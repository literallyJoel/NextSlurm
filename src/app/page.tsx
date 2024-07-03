import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";

import Link from "next/link";
import JobsView from "@/components/home/jobsView";

export default async function Home() {
  const session = await getServerAuthSession();
  const userOrgs = await api.users.getOrganisations({ role: [1, 2] });
  const isOrgModerator = userOrgs.length > 0;
  const shouldSetup = await api.setup.getRequiresSetup();
  //There will very rarely be queued jobs, so we fetch them here so we can hide the display if there are none.
  const queuedJobs = await api.jobs.getAll({ filter: "queued" });
  if (shouldSetup) {
    redirect("/setup");
  }

  if (!session) {
    redirect("/api/auth/signin");
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 text-white">
      <div className="bgl container flex flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Hi,{" "}
          <span className="text-fuchsia-600">
            {session.user.name!.split(" ")[0]}.
          </span>
        </h1>
        <div className="flex w-2/4 flex-row justify-between">
          <Link
            href="/jobs"
            className="w-5/12 rounded-lg bg-slate-800 p-2 text-center hover:bg-slate-800/80"
          >
            Manage Jobs
          </Link>

          {(isOrgModerator || sessionStorage.user.role === 1) && (
            <Link
              href="/jobtypes"
              className="w-5/12 rounded-lg bg-slate-800 p-2 text-center hover:bg-slate-800/80"
            >
              Manage Job Types
            </Link>
          )}
        </div>
      </div>
      <div
        className={`grid grid-cols-${queuedJobs.length > 0 ? "4" : "3"} gap-2 px-16`}
      >
        {queuedJobs.length > 0 && <JobsView filter="queued" />}
        <JobsView filter="running" />
        <JobsView filter="completed" />
        <JobsView filter="failed" />
      </div>
    </main>
  );
}
