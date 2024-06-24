"use client";
import BashEditor from "@/components/ui/bash-editor";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export default function CreateJobType() {
  const selected = useSearchParams().get("selected");
  const router = useRouter();
  const createJobType = api.jobTypes.create.useMutation();
  const [parameters, setParameters] = useState<
    {
      name: string;
      type: "string" | "number" | "boolean";
      defaultValue?: string;
    }[]
  >([]);
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSession(),
  });

  const { data: userMemberships, isFetched } =
    api.users.getOrganisations.useQuery(
      {
        userId: session?.user.id,
        role: [1, 2],
      },
      {
        enabled: !!session && !!session.user,
      },
    );

  useEffect(() => {
    if (isFetched && session) {
      console.log(userMemberships);
      if (
        (!userMemberships || userMemberships.length === 0) &&
        session.user.role !== 1
      ) {
        router.replace("/");
      }
    }
  }, [isFetched, session, userMemberships]);

  const formSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    script: z.string().min(1),
    hasFileUpload: z.boolean().default(false),
    arrayJob: z.boolean().default(false),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createJobType.mutate(values);
  };

  // Watchers for the form fields
  const fileUploadWatcher = form.watch("hasFileUpload", false);
  const arrayJobWatcher = form.watch("arrayJob", false);
  const scriptWatcher = form.watch("script", "");

  useEffect(() => {
    setParameters(getUpdatedParameters(extractParameters(scriptWatcher)));
  }, [scriptWatcher]);

  //Takes the script and extracts the {{parameters}}
  function extractParameters(script: string): string[] {
    const pattern = /{{(.*?)}}/g;
    const matches = script.match(pattern);
    return matches
      ? [...new Set(matches.map((match) => match.replace(/{{|}}/g, "")))]
      : [];
  }

  //Takes the extracted parameters and updates the parameters state
  function getUpdatedParameters(extractedParameters: string[]) {
    //Createa a copy of the parameters state
    const _parameters = [...parameters];
    //Convert to a set of names
    const parametersSet = new Set(
      _parameters.map((parameter) => parameter.name),
    );

    //Add any new parameters
    extractedParameters.forEach((name) => {
      if (!parametersSet.has(name)) {
        _parameters.push({
          name,
          type: "string",
        });
        parametersSet.add(name);
      }
    });

    //Remove any parameters that are no longer present
    _parameters.forEach((parameter) => {
      if (!extractedParameters.includes(parameter.name)) {
        _parameters.splice(_parameters.indexOf(parameter), 1);
      }
    });

    return _parameters;
  }

  useEffect(() => {
    if (arrayJobWatcher && !fileUploadWatcher) {
      form.setValue("hasFileUpload", true);
    }
  }, [arrayJobWatcher, fileUploadWatcher, form]);

  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex w-full flex-row justify-center text-xl font-semibold text-white">
          Create a New Job Type
        </div>
        <div className="w-1/2 p-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel className="text-white">Name</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter a name..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel className="text-white">Description</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Include any information about file uploads, etc"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex w-full flex-row items-center justify-center gap-8 pb-14">
                <FormField
                  control={form.control}
                  name="hasFileUpload"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="group relative flex flex-col items-center justify-center gap-1">
                          <Checkbox
                            className="h-8 w-8 border-white transition-colors duration-200 hover:bg-slate-700 data-[state=checked]:bg-slate-800"
                            {...field}
                            onCheckedChange={(checked) => {
                              if (arrayJobWatcher) {
                                form.setValue("hasFileUpload", true);
                              } else {
                                field.onChange(checked);
                              }
                            }}
                            checked={field.value || arrayJobWatcher}
                            disabled={arrayJobWatcher}
                          />
                          <span className="text-white">
                            Accepts File Uploads?
                          </span>
                          <div className="absolute top-16 flex w-full flex-col items-center justify-center gap-1 rounded-md bg-slate-800 px-4 py-1 text-sm text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                            Allows the user to upload files when creating the
                            job.
                          </div>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arrayJob"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="group relative flex flex-col items-center justify-center gap-1">
                          <Checkbox
                            className="h-8 w-8 border-white transition-colors duration-200 hover:bg-slate-700 data-[state=checked]:bg-slate-800"
                            {...field}
                            onCheckedChange={(checked) => {
                              form.setValue("arrayJob", checked);
                              if (checked) {
                                form.setValue("hasFileUpload", true);
                              }
                            }}
                            checked={field.value}
                          />
                          <span className="text-white">Array Job Support?</span>
                          <div className="absolute top-16 flex w-full flex-col items-center justify-center gap-1 rounded-md bg-slate-800 px-4 py-1 text-sm text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
                            Marks the job as an array job, allowing the user to
                            specify different parameters for each run.
                          </div>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="script"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel className="text-white">Script</FormLabel>
                      <FormMessage />
                    </div>
                    <FormDescription className="text-slate-300">
                      Any runtime parameters should be written as{" "}
                      <span className="text-fuchsia-400">
                        {"{{parameter}}"}
                      </span>
                      .<br />{" "}
                      <span className="font-semibold text-red-400">
                        Do not include the Slurm Directives at the top of the
                        script.
                      </span>{" "}
                      these will be added automatically.
                      {fileUploadWatcher && !arrayJobWatcher && (
                        <>
                          <br />
                          Use bash variables{" "}
                          <span className="text-orange-400">$file1</span>,
                          <span className="text-orange-400">$file2</span>, etc
                          to access user-uploaded files.
                        </>
                      )}
                      {arrayJobWatcher && (
                        <>
                          <br />
                          Uploaded files will be treated as input for each job
                          in the array. Use the $arrayfile bash variable to
                          access the file. <br /> If multiple files are required
                          for each array run, use{" "}
                          <span className="text-orange-400">
                            $arrayfile1
                          </span>,{" "}
                          <span className="text-orange-400">$arrayfile2</span>,{" "}
                          etc.
                        </>
                      )}
                    </FormDescription>
                    <FormControl>
                      <BashEditor onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-4 gap-2">
                {parameters.map((parameter) => (
                  <div className="flex w-full flex-row items-center justify-center gap-8 pb-14 text-white">
                    <FormLabel>{parameter.name}</FormLabel>
                  </div>
                ))}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
