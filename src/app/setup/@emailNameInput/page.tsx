"use client";

import { z } from "zod";
import { useSetup } from "../context/setupContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import {
  Card,
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
import NextButton from "@/components/ui/nextButton";
import { motion } from "framer-motion";

const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export default function emailNameInput() {
  const { updateUser, nextStep, getUser } = useSetup();
  const user = getUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user.name ?? "",
      email: user.email ?? "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateUser(values);
    nextStep();
  }

  return (
    <motion.div
      key="emailName"
      layoutId="setup"
      initial={{ opacity: 0, x: -1000 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 1000 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
      className="flex  w-1/2  flex-row items-center justify-center  p-2"
    >
      <Card className="w-full rounded-xl border-none bg-white/70 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            Create a local account to get started. Third party login can be
            enabled later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Name</FormLabel>
                      <FormMessage />
                    </div>

                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Email</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Input placeholder="John@Doe.com" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex w-full flex-row justify-end py-2">
                <NextButton type="submit" />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
