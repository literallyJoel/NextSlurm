"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

export default function Temp() {
  const createJob = api.jobs.create.useMutation();
  function jobsTest() {
    createJob.mutate(
      {
        name: "Test",
        jobTypeId: "7413f6b1-9d0e-4cf8-9562-f3a309dd2c4f",
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
