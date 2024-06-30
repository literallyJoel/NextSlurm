import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/server/api/root";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "next-auth/react";

type RouterOutput = inferRouterOutputs<AppRouter>;
type JobType =
  RouterOutput["jobTypes"]["get"] extends Array<infer T>
    ? T
    : RouterOutput["jobTypes"]["get"];

export default function JobTypeListItem({
  jobType,
  selected,
}: {
  jobType: Exclude<JobType, undefined>;
  selected?: boolean;
}) {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSession(),
  });

  return (
    <Link
      href={`?selected=${jobType.id}`}
      className={`${selected ? "bg-slate-800/20 shadow-inner" : "bg-slate-700 shadow-xl"} flex h-auto w-full flex-row items-center justify-between gap-2 rounded-lg border-2 border-slate-200  p-4  hover:bg-slate-800/20 hover:shadow-inner`}
    >
      <div className="flex w-full flex-row items-center gap-2">
        <div className="flex w-full flex-col gap-1">
          <div className="flex w-full flex-row justify-between">
            <div className="text-sm font-medium text-white">{jobType.name}</div>
            <div className="text-sm font-medium text-white">
              <span className="text-xs text-slate-300">
                {session && session.user.id === jobType.createdBy.id
                  ? "You"
                  : jobType.createdBy.name}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-300">{jobType.description}</div>
        </div>
      </div>
    </Link>
  );
}
