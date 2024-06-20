"use client";
import { motion } from "framer-motion";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { api } from "@/trpc/react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useSearchParams } from "next/navigation";

export default function CreateOrgForm() {
  const selected = useSearchParams().get("selected");
  const utils = api.useUtils();
  const renameOrganisation = api.organisations.rename.useMutation();

  const formSchema = z.object({
    name: z.string().min(3).max(50),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    const { name } = data;
    renameOrganisation.mutate(
      { organisationId: selected!, organisationName: name },
      {
        onSuccess: () => utils.organisations.get.invalidate(),
      },
    );
  }

  return (
    <div className="flex h-full w-full flex-col  gap-2 rounded-lg bg-slate-700 p-4 text-white">
      <CardHeader>
        <CardTitle className="flex flex-row justify-between">
          <div>Rename Organisation</div>
        </CardTitle>
      </CardHeader>
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

            <motion.button
              type="submit"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-full rounded-lg bg-slate-800 p-2 text-white transition-colors duration-200 hover:bg-fuchsia-600"
            >
              Rename Organisation
            </motion.button>
          </form>
        </Form>
      </CardContent>
    </div>
  );
}
