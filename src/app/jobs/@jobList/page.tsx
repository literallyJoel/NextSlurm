"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";
import { motion } from "framer-motion";
import { PlusIcon } from "@heroicons/react/24/outline";
import { api } from "@/trpc/react";

import { useRouter, useSearchParams } from "next/navigation";

export default function jobList() {
  const [searchTerm, setSearchTerm] = useState("");

  const router = useRouter();
  const selected = useSearchParams().get("selected");
  return (
    <div className="flex h-full w-3/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <div className="r  flex w-full flex-row justify-center  text-xl font-semibold text-white">
        Your Jobs
      </div>

      <div className="flex flex-row gap-2">
        <Input
          type="text"
          placeholder="Search for a job type"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <motion.button
          onClick={() => router.replace("/jobtypes")}
          className="group relative h-10 w-10 rounded-full bg-slate-500 p-2 transition-colors duration-200 hover:bg-fuchsia-700"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div whileHover={{ rotate: 360 }}>
            <PlusIcon className="h-5 w-5 text-white" />
          </motion.div>

          <div className="absolute -left-1 top-11 rounded-lg bg-slate-600 p-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100">
            Create Job
          </div>
        </motion.button>
      </div>

      <div className="flex h-full w-full flex-col gap-2 overflow-y-auto"></div>
    </div>
  );
}
