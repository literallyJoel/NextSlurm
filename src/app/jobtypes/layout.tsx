"use client";

import { ReactNode } from "react";

export default function JobTypesLayout({
  jobTypeList,
  createJobType,
}: {
  jobTypeList: ReactNode;
  createJobType: ReactNode;
}) {
  return (
    <div className="min-w-screen flex min-h-screen flex-col items-center bg-slate-900 p-4">
      <div className="flex w-full flex-row items-center justify-center p-2 text-xl font-semibold text-white">
        Job <span className="text-fuchsia-500">Types</span>
      </div>
      <div className="flex h-[90vh] w-full  flex-row gap-1 rounded-lg bg-slate-800 p-2">
        {jobTypeList}
        {createJobType}
      </div>
    </div>
  );
}
