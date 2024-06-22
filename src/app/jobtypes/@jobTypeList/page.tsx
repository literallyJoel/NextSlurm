"use client";

import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function jobTypeList() {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <div className="flex h-full w-3/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <div className="r  flex w-full flex-row justify-center  text-xl font-semibold text-white">
        Your Job Types
      </div>

      <div>
        <Input
          type="text"
          placeholder="Search for a job type"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2 h-full w-full overflow-y-auto">
        
      </div>
    </div>
  );
}
