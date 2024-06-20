"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { api } from "@/trpc/react";
import { useSetup } from "@/app/setup/context/setupContext";
import NextButton from "@/components/ui/nextButton";
const formSchema = z.object({
  organisationName: z.string().min(1),
});
import { motion } from "framer-motion";

export default function organisationCreation() {
  const router = useRouter();
  const { getUser, setErr, nextStep } = useSetup();
  const createInitial = api.setup.createInitial.useMutation();
  const user = getUser();
  useEffect(() => {
    if (!user.email || !user.password || !user.name) {
      router.replace("?step=2");
    }
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    createInitial.mutate(
      {
        organisationName: values.organisationName,
        email: user.email!,
        password: user.password!,
        name: user.name!,
      },
      {
        onError: (err) => {
          setErr(err.message);
          router.push("?step=-1");
        },
        onSuccess: () => {
          signIn("credentials", {
            email: user.email!,
            password: user.password!,
            redirect: false,
          });

          nextStep();
        },
      },
    );
  }

  return (
    <motion.div
      key="organisation"
      layoutId="setup"
      initial={{ opacity: 0, x: -1000 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 1000 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
      className="flex  w-1/2  flex-row items-center justify-center  p-2"
    >
      <Card className="w-full rounded-xl border-none bg-white/70 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Create an Organisation</CardTitle>
          <CardDescription>You'll be the admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="organisationName"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Organisation Name</FormLabel>
                      <FormMessage />
                    </div>

                    <FormControl>
                      <Input placeholder="Apterture Laboratories" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex w-full flex-row items-center justify-end">
                <NextButton type="submit" />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
