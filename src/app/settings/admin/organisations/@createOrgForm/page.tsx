"use client";
import { motion } from "framer-motion";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronsUpDown } from "lucide-react";
import { api } from "@/trpc/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Suspense } from "react";

export default function CreateOrgForm() {
  const utils = api.useUtils();
  const createOrganisation = api.organisations.create.useMutation();
  const formSchema = z.object({
    name: z.string().min(3).max(50),
    adminId: z.string().uuid(),
  });
  const [users, usersQuery] = api.users.get.useSuspenseQuery();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    const { name, adminId } = data;
    createOrganisation.mutate(
      { organisationName: name, adminId },
      { onSuccess: () => utils.organisations.get.invalidate() },
    );
  }

  return (
    <div className="flex w-3/12 flex-col gap-2 rounded-lg bg-slate-700 p-4 text-white">
      <CardHeader>
        <CardTitle className="flex flex-row justify-between">
          <div>Create Organisation</div>
        </CardTitle>
        <CardDescription className="text-slate-400">
          You can create a new organisation here. You'll set up one admin now,
          and you can add other users later.
        </CardDescription>
      </CardHeader>
      <Suspense fallback={<div>Loading...</div>}>
        <CardContent className="flex flex-col gap-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Organisation Name</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Input
                        className="text-black"
                        placeholder="Aperture Laboratories"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminId"
                render={({ field }) => {
                  const selectedUser = users.find(
                    (user) => user.id === field.value,
                  );
                  return (
                    <FormItem className="w-full pt-3">
                      <div className="flex w-full flex-row items-center justify-between">
                        <FormLabel>Organisation Admin</FormLabel>
                        <FormMessage />
                      </div>
                      <Popover>
                        <PopoverTrigger
                          className="bg-white hover:bg-white/80"
                          asChild
                        >
                          <FormControl>
                            <Button
                              role="combobox"
                              className={cn(
                                "w-full justify-between text-black",
                                !field.value && "text-muted-foreground",
                              )}
                            >
                              {field.value ? (
                                <>
                                  {selectedUser?.name}
                                  <span className="p-1 text-xs text-slate-400">
                                    ({selectedUser?.email})
                                  </span>
                                </>
                              ) : (
                                <>Select a user...</>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="border-none bg-transparent p-0">
                          <motion.div
                            initial={{ opacity: 0, y: 0 }}
                            animate={{ opacity: 1, y: 20 }}
                            exit={{ opacity: 0, y: 0 }}
                          >
                            <Command className="rounded-lg border border-none bg-slate-800 text-white shadow-md">
                              <CommandInput placeholder="Search for a user..." />
                              <CommandList>
                                <CommandEmpty>No results found.</CommandEmpty>
                                <CommandGroup>
                                  {users.map((user) => (
                                    <CommandItem
                                      className="bg-slate-800 text-white hover:bg-slate-700 hover:text-white active:bg-slate-800"
                                      onSelect={() => {
                                        form.setValue("adminId", user.id);
                                      }}
                                      key={user.id}
                                      value={user.name}
                                    >
                                      <span className="text-white">
                                        {user.name}
                                        <span className="text-xs text-slate-400">
                                          ({user.email})
                                        </span>
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </motion.div>
                        </PopoverContent>
                      </Popover>
                    </FormItem>
                  );
                }}
              />

              <motion.button
                type="submit"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="w-full rounded-lg bg-slate-800 p-2 text-white transition-colors duration-200 hover:bg-fuchsia-600"
              >
                Create Organisation
              </motion.button>
            </form>
          </Form>
        </CardContent>
      </Suspense>
    </div>
  );
}
