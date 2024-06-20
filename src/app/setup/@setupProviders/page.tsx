"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProviderInfo, useSetup } from "@/app/setup/context/setupContext";
import { ProviderForm } from "@/components/setup/providers/providerForm";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import PreviousButton from "@/components/ui/previousButton";
import NextButton from "@/components/ui/nextButton";
import { motion } from "framer-motion";

const formSchema = z.object({
  providers: z.array(
    z.object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      tenantId: z.string().optional(),
    }),
  ),
});

export default function ProviderSetup() {
  const enableProviders = api.providers.create.useMutation();
  const completeSetup = api.setup.completeSetup.useMutation();
  const { getProviders, updateProviderInfo, prevStep, getProviderInfo } =
    useSetup();
  const router = useRouter();
  const providers = getProviders();

  const methods = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      providers: providers.map((provider) => ({
        name: provider,
        clientId: "",
        clientSecret: "",
        tenantId: "",
      })),
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const _providerInfo: ProviderInfo[] = [];
    values.providers.forEach((provider, index) => {
      if (providers[index]) {
        if (providers[index] === "Microsoft") {
          provider.clientSecret = `${provider.tenantId}||${provider.clientSecret}`;
        }
        _providerInfo.push({ name: providers[index]!, ...provider });
      }
    });
    updateProviderInfo(_providerInfo);
  }

  useEffect(() => {
    const providerInfo = getProviderInfo();
    if (providerInfo.length === providers.length) {
      enableProviders.mutate(providerInfo, {
        onSuccess: () => {
          completeSetup.mutate(undefined, {
            onSuccess: () => {
              updateProviderInfo([]);
            },
          });
          router.push("/");
        },
        onError: (err) => {
          console.error(err);
          updateProviderInfo([]);
        },
      });
    }
  }, [getProviderInfo()]);

  return (
    <motion.div
      key="providerSetup"
      layoutId="setup"
      initial={{ opacity: 0, x: -1000 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 1000 }}
      transition={{ type: "spring", duration: 0.45, bounce: 0.4 }}
      className="flex  w-1/2  flex-row items-center justify-center  p-2"
    >
      <Card className="w-full rounded-xl border-none bg-white/70 backdrop-blur-lg">
        <CardHeader>
          <CardTitle>Provider Setup</CardTitle>
          <CardDescription>
            You'll need to enter the client ID and secret for each provider. The
            client secret is encrypted when stored in the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...methods}>
            <Form {...methods}>
              <form onSubmit={methods.handleSubmit(onSubmit)}>
                {providers.map((provider, index) => (
                  <ProviderForm key={provider} name={provider} index={index} />
                ))}

                <div className="flex w-full flex-row justify-between py-2">
                  <PreviousButton onClick={() => prevStep()} />
                  <NextButton type="submit" />
                </div>
              </form>
            </Form>
          </FormProvider>
        </CardContent>
      </Card>
    </motion.div>
  );
}
