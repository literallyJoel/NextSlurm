"use client";

import { useSearchParams } from "next/navigation";
import { ReactNode } from "react";

export default function JobTypesLayout({
  jobList,
  createJob,
  viewJob,
}: {
  jobList: ReactNode;
  createJob: ReactNode;
  viewJob: ReactNode;
}) {
  const selected = useSearchParams().get("selected");

  return (
    <div className="min-w-screen flex min-h-screen flex-col items-center bg-slate-900 p-4">
      <div className="flex w-full flex-row items-center justify-center p-2 text-xl font-semibold text-white">
        Slurm<span className="text-fuchsia-500">Jobs</span>
      </div>
      <div className="flex h-[90vh] w-full  flex-row gap-1 rounded-lg bg-slate-800 p-2">
        {jobList}
        {selected ? viewJob : createJob}
       
      </div>
    </div>
  );
}
