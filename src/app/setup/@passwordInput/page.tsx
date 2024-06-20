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
import { useSetup } from "@/app/setup/context/setupContext";
import PreviousButton from "@/components/ui/previousButton";
import NextButton from "@/components/ui/nextButton";
import { motion } from "framer-motion";
const formSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long" }),
    confirmPassword: z
      .string()
      .min(8, { message: "Password must be at least 8 characters long" })
      //Contains an uppercase character
      .regex(/[A-Z]/, {
        message:
          "Password must contain at least one upper case character, one lower case character, one number, and one special character.",
      })
      //Contains a lowercase character
      .regex(/[a-z]/, {
        message:
          "Password must contain at least one upper case character, one lower case character, one number, and one special character.",
      })
      //contains a number
      .regex(/\d/, {
        message:
          "Password must contain at least one upper case character, one lower case character, one number, and one special character.",
      })
      //contains a special character
      .regex(/\W/, {
        message:
          "Password must contain at least one upper case character, one lower case character, one number, and one special character.",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default function passwordInput() {
  const { nextStep, prevStep, getUser, updateUser } = useSetup();
  const router = useRouter();

  const user = getUser();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    updateUser({ password: values.password });
    nextStep();
  }

  useEffect(() => {
    if (!user.name || !user.email) {
      router.replace("/setup");
    }
  }, []);

  return (
    <motion.div
      key="password"
      layoutId="setup"
      initial={{ opacity: 0, x: -1000 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 1000 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
      className="flex  w-1/2  flex-row items-center justify-center  p-2"
    >
      <Card className="w-full rounded-xl border-none bg-white/70 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Choose your password</CardTitle>
          <CardDescription>
            Make sure it's at least 8 characters long.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <FormMessage />
                    </div>

                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex w-full flex-row items-center justify-between">
                      <FormLabel>Confirm Password</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex w-full flex-row justify-between py-2">
                <PreviousButton onClick={() => prevStep()} />
                <NextButton type="submit" />
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
