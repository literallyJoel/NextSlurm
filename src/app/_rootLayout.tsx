"use client";

import Toolbar from "@/components/toolbar/toolbar";
import { TRPCReactProvider, api } from "@/trpc/react";
import { GeistSans } from "geist/font/sans";
import { Session } from "next-auth";
import { SessionProvider, getSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

//This exists so we can add the SessionProvider, which requires a client component.
export default function RootLayout({
  children,
  session,
  requiresSetup,
}: {
  children: React.ReactNode;
  session: Session | null;
  requiresSetup: boolean;
}) {
  const pathName = usePathname();
  const router = useRouter();

  if (session === null && !requiresSetup && !pathName.includes("/login")) {
    router.replace("/api/auth/signin");
  }

  if (requiresSetup && pathName !== "/setup") {
    router.replace("/setup");
  }

  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <SessionProvider>
          <TRPCReactProvider>
            <Toolbar />
            {children}
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
