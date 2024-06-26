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


import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";


import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";

export default function AddMemberForm() {
  const selectedOrganisation = useSearchParams().get("selected");
  const addMember = api.organisations.addMember.useMutation();
  const utils = api.useUtils();
  const formSchema = z.object({
    userEmail: z.string().email(),
    role: z.string().refine((str) => {
      return str === "0" || str === "1" || str === "2";
    }),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues:{
        role: "0"
    }
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    const { userEmail, role } = data;
    addMember.mutate(
      {
        organisationId: selectedOrganisation!,
        userEmail,
        role: Number.parseInt(role),
      },
      {
        onSuccess: () => utils.organisations.getMember.invalidate(),
      },
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-lg bg-slate-700 p-4 text-white">
      <CardHeader>
        <CardTitle className="flex flex-row justify-between">
          Add Member
        </CardTitle>
        <CardDescription className="text-slate-400">
          Add a member to the organisation and select their role. Admins have
          full access the the organisation, moderators can create job types, and
          users can only create jobs. Enter the email address of the user you
          want to add, if the account exists, they'll be added to the
          organisation.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <FormField
              control={form.control}
              name="userEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl className="flex flex-row gap-4">
                    <Input
                      className="text-black"
                      placeholder="John@Doe.com"
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organisation Role</FormLabel>
                  <FormControl className="flex flex-row gap-4">
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={"0"}
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="cursor-pointer"
                      >
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem
                              className="border-white text-slate-800"
                              value="0"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer px-2">
                            User
                          </FormLabel>
                        </FormItem>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="cursor-pointer"
                      >
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem
                              className="border-white text-slate-800"
                              value="1"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer px-2">
                            Moderator
                          </FormLabel>
                        </FormItem>
                      </motion.div>
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="cursor-pointer"
                      >
                        <FormItem>
                          <FormControl>
                            <RadioGroupItem
                              className="border-white text-slate-800"
                              value="2"
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer px-2">
                            Admin
                          </FormLabel>
                        </FormItem>
                      </motion.div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-full rounded-lg bg-slate-800 p-2 text-white transition-colors duration-200 hover:bg-fuchsia-600"
            >
              Add Member
            </motion.button>
          </form>
        </Form>
      </CardContent>
    </div>
  );
}
