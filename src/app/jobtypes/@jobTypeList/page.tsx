"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";
import { motion } from "framer-motion";
import { PlusIcon } from "@heroicons/react/24/outline";
export default function jobTypeList() {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <div className="flex h-full w-3/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <div className="r  flex w-full flex-row justify-center  text-xl font-semibold text-white">
        Your Job Types
      </div>

      <div className="flex flex-row gap-2">
        <Input
          type="text"
          placeholder="Search for a job type"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <motion.button
          className="group relative rounded-full bg-slate-500 p-2"
          whileHover={{ rotate: 360, scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <PlusIcon className="h-5 w-5 text-white" />
          <div className="absolute -left-1 top-11 rounded-lg bg-slate-600 p-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100">
            Create Job Type
          </div>
        </motion.button>
      </div>

      <div className="flex h-full w-full flex-col gap-2 overflow-y-auto">
        
      </div>
    </div>
  );
}
