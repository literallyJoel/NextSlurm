"use client";

import { ReactNode } from "react";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";

import { api } from "@/trpc/react";
import { SetupProvider } from "./context/setupContext";

export default function SetupLayout({
  children,
  emailNameInput,
  passwordInput,
  organisationCreation,
  selectProviders,
  setupProviders,
}: {
  children: ReactNode;
  emailNameInput: ReactNode;
  passwordInput: ReactNode;
  organisationCreation: ReactNode;
  selectProviders: ReactNode;
  setupProviders: ReactNode;
}) {
  const router = useRouter();
  const {data: requiresSetup} = api.setup.getRequiresSetup.useQuery();

  const step = useSearchParams().get("step");
  if (!requiresSetup) {
    router.replace("/");
  }

  const SetupComponent = () => {
    switch (step) {
      case "1":
        return emailNameInput;
      case "2":
        return passwordInput;
      case "3":
        return organisationCreation;
      case "4":
        return selectProviders;
      case "5":
        return setupProviders;
      default:
        return emailNameInput;
    }
  };
  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-900 text-white">
      <div className="container flex w-full flex-col items-center justify-center gap-12 px-4 py-16">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
          Web<span className="text-fuchsia-600">Slurm</span>
        </h1>
        <SetupProvider>
          <AnimatePresence mode="wait">
            <SetupComponent />
          </AnimatePresence>
        </SetupProvider>
      </div>
    </main>
  );
}
