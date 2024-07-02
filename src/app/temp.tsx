"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export default function Temp() {
  const createJob = api.jobs.create.useMutation();
  function jobsTest() {
    createJob.mutate(
      {
        name: "Test",
        jobTypeId: "fa25a852-a8d3-4725-a7c7-491ceaac80e0",
        parameters: [{ key: "test", value: "hello, world!" }],
      },
      {
        onSuccess: () => {
          alert("Job created successfully");
        },
        onError: (err) => {
          alert("Error creating job");
          console.error(err);
        },
      },
    );
  }

  return (
    <Button
      className="h-full w-full bg-slate-800 p-4 hover:bg-slate-800/60"
      onClick={() => jobsTest()}
    >
      Jobs Test
    </Button>
  );
}
