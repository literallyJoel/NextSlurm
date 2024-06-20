import "@/styles/globals.css";

import { GeistSans } from "geist/font/sans";

import { TRPCReactProvider } from "@/trpc/react";
import { SessionProvider } from "next-auth/react";
import Root from "./_rootLayout";
import { api } from "@/trpc/server";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/server/auth";

export const metadata = {
  title: "Create T3 App",
  description: "Generated by create-t3-app",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requiresSetup = await api.setup.getRequiresSetup();
  const session = await getServerAuthSession();

  if (
    !requiresSetup &&
    !session &&
    typeof window !== "undefined" &&
    window.location.pathname !== "/api/auth/signin" &&
    window.location.pathname !== "/auth/login"
  ) {
    redirect("/api/auth/signin");
  }

  if (
    requiresSetup &&
    typeof window !== "undefined" &&
    !window.location.pathname.includes("/setup")
  ) {
    redirect("/setup");
  }

  return <Root children={children} />;
}
