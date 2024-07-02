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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";

import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import Loading from "@/components/ui/loading";
import { useFocus } from "@/app/hooks/useFocus";
import { XCircleIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "lucide-react";

export default function CreateJobType() {
  const selected = useSearchParams().get("selected");
  const router = useRouter();
  const createJobType = api.jobTypes.create.useMutation();
  const updateJobType = api.jobTypes.update.useMutation();
  const [view, setView] = useState<"create" | "success" | "error">("create");
  const utils = api.useUtils();
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => getSession(),
  });

  const { data: selectedJobType, isLoading: loadingSelected } =
    api.jobTypes.get.useQuery(
      {
        id: selected!,
      },
      { enabled: !!selected },
    );

  const { data: userMemberships, isFetched } =
    api.users.getOrganisations.useQuery(
      {
        userId: session?.user.id,
        role: [1, 2],
      },
      { enabled: !!session && !!session.user },
    );

  useEffect(() => {
    if (isFetched && session) {
      if (
        !userMemberships ||
        userMemberships.length === 0 ||
        session.user.role !== 1
      ) {
        router.replace("/");
      } else if (userMemberships.length === 1) {
        form.setValue("organisationId", userMemberships[0]!.id!);
      }
    }
  }, [isFetched, session, userMemberships]);

  useEffect(() => {
    if (selected && selectedJobType && !Array.isArray(selectedJobType)) {
      form.setValue("name", selectedJobType.name);
      form.setValue("description", selectedJobType.description);
      form.setValue("script", selectedJobType.script);
      form.setValue("hasFileUpload", selectedJobType.hasFileUpload);
      form.setValue("arrayJob", selectedJobType.arrayJob);
      //Because this is retrieved on a database join, it can be null, so we need to map it onto undefined
      const _params = selectedJobType.parameters.map((param) => ({
        ...param,
        type: param.type as "string" | "number" | "boolean",
        defaultValue: param.defaultValue ?? undefined,
      }));
      form.setValue("parameters", _params);
    } else {
      form.reset();
    }
  }, [selected, selectedJobType]);

  const formSchema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    script: z
      .string()
      .min(1, "A script must be provided")
      .refine((value) => {
        if (
          value.includes("#SBATCH --job-name") ||
          value.includes("#SBATCH --output") ||
          value.includes("#SBATCH --array")
        ) {
          return false;
        }
        return true;
      }, "Job name, output, and array directives must not be included. These will be added automatically."),
    hasFileUpload: z.boolean().default(false),
    arrayJob: z.boolean().default(false),
    organisationId: selected ? z.string().uuid().optional() : z.string().uuid(),
    parameters: z
      .array(
        z.object({
          name: z.string().min(1),
          type: z.union([
            z.literal("string"),
            z.literal("number"),
            z.literal("boolean"),
          ]),
          defaultValue: z.string().optional(),
        }),
      )
      .optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: selectedJobType?.name ?? "",
      description: "",
      hasFileUpload: false,
      arrayJob: false,
      parameters: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "parameters",
  });

  const scriptEditorRef = useRef<HTMLTextAreaElement>(null);
  const setFocus = useFocus(scriptEditorRef);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!selected) {
      createJobType.mutate(values, {
        onSuccess: () => {
          utils.jobTypes.invalidate();
          setView("success");
        },
        onError: () => setView("error"),
      });
    } else {
      updateJobType.mutate(
        { ...values, id: selected },
        {
          onSuccess: () => {
            utils.jobTypes.invalidate();
            setView("success");
          },
          onError: () => setView("error"),
        },
      );
    }
  }

  const fileUploadWatcher = form.watch("hasFileUpload", false);
  const arrayJobWatcher = form.watch("arrayJob", false);

  const extractScriptParameters = z
    .function()
    .args(z.string())
    .returns(z.array(z.string()))
    .implement((script) => {
      const pattern = /{{(.*?)}}/g;
      const matches = script.match(pattern);
      return matches
        ? [...new Set(matches.map((match) => match.replace(/{{|}}/g, "")))]
        : [];
    });

  const getUpdatedParameters = z
    .function()
    .args(z.array(z.string()))
    .returns(
      z.array(
        z.object({
          name: z.string().min(1),
          type: z.union([
            z.literal("string"),
            z.literal("number"),
            z.literal("boolean"),
          ]),
          defaultValue: z.string().optional(),
        }),
      ),
    )
    .implement((extractedParameters) => {
      const _parameters = form.getValues("parameters") || [];
      const parametersSet = new Set(
        _parameters.map((parameter) => parameter.name),
      );

      extractedParameters.forEach((name) => {
        if (!parametersSet.has(name)) {
          append({
            name,
            type: "string", // Default type
          });
        }
      });

      _parameters.forEach((parameter) => {
        if (!extractedParameters.includes(parameter.name)) {
          remove(_parameters.indexOf(parameter));
        }
      });

      setTimeout(() => {
        setFocus();
      }, 1);

      return _parameters;
    });

  if (createJobType.isPending || (selected && loadingSelected)) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-700">
        <Loading />
      </div>
    );
  }

  if (view === "success") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-700">
        <AnimatePresence>
          <motion.span
            initial={{ scale: 0, opacity: 0, rotate: 360 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.4 }}
          >
            <CheckCircleIcon className="h-16 w-16 text-green-400" />
          </motion.span>
        </AnimatePresence>

        <div className="text-2xl font-semibold text-white">
          Successfully {selected ? "updated" : "created"} Job Type!
        </div>
        <Button
          onClick={() => {
            if (!selected) {
              form.reset();
            }
            setView("create");
          }}
        >
          {selected ? "Back" : "Create Another"}
        </Button>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-700">
        <AnimatePresence>
          <motion.span
            initial={{ scale: 0, opacity: 0, rotate: 360 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ duration: 0.4 }}
          >
            <XCircleIcon className="h-16 w-16 text-red-400" />
          </motion.span>
        </AnimatePresence>
        <div className="pb-2 text-2xl font-semibold text-white">
          There was an issue {selected ? "updating" : "creating"} your Job Type.
        </div>

        <Button onClick={() => setView("create")}>Back</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-y-auto rounded-lg bg-slate-700 p-4">
      <div className="jusify-center flex flex-col items-center gap-2">
        <div className="flex w-full flex-row justify-center text-xl font-semibold text-white">
          {selected ? "Edit Job Type" : "Create a New Job Type"}
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

              <div className="flex w-full flex-row items-center justify-between gap-8 ">
                <FormField
                  control={form.control}
                  name="hasFileUpload"
                  render={({ field }) => (
                    <FormItem className="w-1/2">
                      <FormControl>
                        <div className="flex flex-row items-start gap-3 space-y-0 rounded-lg border-2 border-slate-200 px-4 py-3 shadow-xl">
                          <motion.span
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Checkbox
                              checked={arrayJobWatcher ? true : field.value}
                              onCheckedChange={field.onChange}
                              className="h-6 w-6 border-white transition-colors duration-200 hover:bg-slate-700 data-[state=checked]:bg-slate-800"
                              disabled={arrayJobWatcher}
                            />
                          </motion.span>
                          <div className="flex flex-col gap-1 leading-none">
                            <FormLabel className="font-medium leading-none text-white">
                              File Uploads?
                            </FormLabel>
                            <FormDescription className="text-slate-300">
                              Include a file upload field when creating the job
                            </FormDescription>
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
                    <FormItem className="w-1/2">
                      <FormControl>
                        <div className="flex flex-row items-start gap-3 space-y-0 rounded-lg border-2 border-slate-200 px-4 py-3 shadow-xl">
                          <motion.span
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="h-6 w-6 border-white transition-colors duration-200 hover:bg-slate-700 data-[state=checked]:bg-slate-800"
                            />
                          </motion.span>
                          <div className="flex flex-col gap-1 leading-none">
                            <FormLabel className="font-medium leading-none text-white">
                              Array Job?
                            </FormLabel>
                            <FormDescription className="text-slate-300">
                              Run this job multiple times with different user
                              inputs?
                            </FormDescription>
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
                        {"{{parameter}}"}{" "}
                      </span>
                      .
                      <br />{" "}
                      <span className="font-semibold text-red-400">
                        Do not include the Job Name, Output, or Array Slurm
                        Directives.
                      </span>{" "}
                      These will be added automatically.
                      {fileUploadWatcher && (
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
                          The user will be able to upload multiple zip files.
                          $file1, $file2, etc will refer to the files for that
                          array run.
                        </>
                      )}
                    </FormDescription>
                    <BashEditor
                      editorRef={scriptEditorRef}
                      value={field.value}
                      onChange={(e) => {
                        field.onChange(e);
                        const scriptParams = extractScriptParameters(
                          e.target.value,
                        );
                        getUpdatedParameters(scriptParams);
                      }}
                    />
                  </FormItem>
                )}
              />

              {fields.map((item, index) => (
                <div
                  key={item.id}
                  className="grid w-full grid-cols-3 gap-2 rounded-lg border-2 border-slate-200  p-2 shadow-xl"
                >
                  <FormField
                    control={form.control}
                    name={`parameters.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Parameter</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Parameter name"
                            value={field.value}
                            className=" border-none bg-slate-700 p-0 font-bold disabled:cursor-default disabled:text-white disabled:opacity-100"
                            disabled
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parameters.${index}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white">Type</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue(
                              `parameters.${index}.defaultValue`,
                              "",
                            );
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parameters.${index}.defaultValue`}
                    render={({ field }) => (
                      <FormItem className="flex flex-col items-center justify-center gap-2">
                        <FormLabel className="text-white">
                          Default Value
                        </FormLabel>
                        <FormControl>
                          {form.watch(`parameters.${index}.type`) ===
                          "string" ? (
                            <Input
                              type="text"
                              placeholder="Default value"
                              defaultValue=""
                              {...field}
                            />
                          ) : form.watch(`parameters.${index}.type`) ===
                            "number" ? (
                            <Input
                              type="number"
                              placeholder="Default value"
                              defaultValue={0}
                              {...field}
                            />
                          ) : (
                            <Checkbox
                              className="h-8 w-8 border-white transition-colors duration-200 hover:bg-slate-700 data-[state=checked]:bg-slate-800"
                              checked={field.value === "true"}
                              defaultChecked={false}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? "true" : "false")
                              }
                            />
                          )}
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ))}

              <div className="flex flex-row justify-end gap-2">
                <motion.button
                  className="rounded-lg bg-slate-500 p-2 text-white transition-colors duration-200 hover:bg-fuchsia-700"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="submit"
                >
                  {selected ? "Update Job Type" : "Create Job Type"}
                </motion.button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
