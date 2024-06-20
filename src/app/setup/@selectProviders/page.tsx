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
import { ProviderBttn } from "@/components/setup/providers/providerBttn";
import { useSetup } from "@/app/setup/context/setupContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import googleLogo from "@/app/_assets/img/authproviders/google.png";
import microsoftLogo from "@/app/_assets/img/authproviders/microsoft.png";
import slackLogo from "@/app/_assets/img/authproviders/slack.png";
import { api } from "@/trpc/react";

export default function selectProviders() {
  const { toggleProvider, getProviders, nextStep } = useSetup();
  const providers = getProviders();
  const router = useRouter();
  const completeSetup = api.setup.completeSetup.useMutation();
  return (
    <motion.div
      key="enableProviders"
      layoutId="setup"
      initial={{ opacity: 0, x: -1000 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 1000 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
      className="flex  w-1/2  flex-row items-center justify-center  p-2"
    >
      <Card className="w-full rounded-xl border-none bg-white/70 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Do you want to enable third party login?</CardTitle>
          <CardDescription>
            This is recommended, but requires some additional setup. You can
            enable more than one now, and change them later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <ProviderBttn
            name="Google"
            img={googleLogo}
            toggleProvider={toggleProvider}
            providers={providers}
          />
          <ProviderBttn
            name="Microsoft"
            img={microsoftLogo}
            toggleProvider={toggleProvider}
            providers={providers}
          />
          <ProviderBttn
            name="Slack"
            img={slackLogo}
            toggleProvider={toggleProvider}
            providers={providers}
          />
        </CardContent>

        <CardFooter className="flex flex-row justify-end">
          <Button
            onClick={() => {
              if (providers.length === 0) {
                completeSetup.mutate(undefined, {
                  onSuccess: () => router.push("/"),
                });
              } else {
                nextStep();
              }
            }}
          >
            {providers.length === 0
              ? "Continue with Local Only"
              : "Setup Providers"}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
