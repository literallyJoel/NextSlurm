"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { z } from "zod";
import { motion, useAnimation } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { getCsrfToken, getProviders, signIn } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import googleLogo from "@/app/_assets/img/authproviders/google.png";
import microsoftLogo from "@/app/_assets/img/authproviders/microsoft.png";
import slackLogo from "@/app/_assets/img/authproviders/slack.png";

export default function login() {
  const formSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      callbackUrl: "/",
    });
  }

  const { data: providers } = useQuery({
    queryKey: ["props"],
    queryFn: () => {
      return getProviders();
    },
  });

  const queryParams = useSearchParams();
  const controls = useAnimation();

  useEffect(() => {
    if (queryParams.get("error")) {
      controls.start("start");
    }
    return () => {
      controls.stop();
    };
  }, [queryParams.get("error")]);
  const ErrorView = () => {
    const error = queryParams.get("error");

    switch (error?.toLowerCase()) {
      case "credentialssignin":
        return <p className="text-red-500">Invalid email or password</p>;
      default:
        return <></>;
    }
  };

  const variants = {
    start: (i: number) => ({
      rotate: i % 2 === 0 ? [-1, 1.3, 0] : [1, -1.4, 0],
    }),
    reset: {
      rotate: 0,
    },
  };

  return (
    <motion.div
      animate={controls}
      variants={variants}
      transition={{ duration: 0.4, delay: 0 }}
      className="flex w-full flex-row items-center justify-center"
    >
      <Card className="w-5/12 rounded-xl border-none bg-white/70 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Login to your account to use WebSlurm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
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

              <ErrorView />

              <div className="flex w-full flex-row justify-end py-2">
                <motion.div whileHover={{ rotate: 360 }}>
                  <Button
                    type="submit"
                    className="group transform rounded-full  transition duration-500 ease-in-out hover:scale-110 hover:bg-fuchsia-600"
                  >
                    <ChevronRightIcon className="size-5 text-white transition-colors" />
                  </Button>
                </motion.div>
              </div>
            </form>
          </Form>
        </CardContent>

        {providers &&
          Object.values(providers) &&
          Object.values(providers).length !== 0 && (
            <>
              <div className="flex w-full flex-col items-center justify-between">
                Login with
              </div>
              <CardFooter className="grid grid-cols-3 gap-2 border-t border-slate-400 py-4 ">
                {Object.values(providers).map((provider) => {
                  if (
                    provider.name === "Email" ||
                    provider.name === "Credentials"
                  ) {
                    return null;
                  }
                  return (
                    <div key={provider.name}>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        className=" flex w-1/2 flex-col items-center justify-center gap-2 rounded-lg bg-slate-900 p-4"
                        onClick={() =>
                          signIn(provider.id, { callbackUrl: "/" })
                        }
                      >
                        <Image
                          src={
                            provider.name === "Microsoft"
                              ? microsoftLogo
                              : provider.name === "Google"
                                ? googleLogo
                                : slackLogo
                          }
                          width={70}
                          height={70}
                          alt={provider.name}
                        />
                        <div className="text-sm font-semibold text-white">
                          {provider.name}
                        </div>
                      </motion.button>
                    </div>
                  );
                })}
              </CardFooter>
            </>
          )}
      </Card>
    </motion.div>
  );
}
