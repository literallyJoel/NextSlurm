"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

export default function createJobType() {
  const selected = useSearchParams().get("selected");
 
  
  const formSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    script: z.string().min(1),
    hasFileUpload: z.boolean().default(false),
    arrayJob: z.boolean().default(false),
    parameters: z.array(
      z.object({
        name: z.string().min(1),
        type: z
          .string()
          .refine(
            (type) =>
              type === "string" || type === "number" || type === "boolean",
            "Must be a string, number or boolean",
          ),
        defaultValue: z.string().optional(),
      }),
    ),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {

    }
  })
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex w-full flex-row justify-center text-xl font-semibold text-white">
          Create a New Job Type
        </div>
      </div>
    </div>
  );
}
