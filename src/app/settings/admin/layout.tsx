"use client";
import Link from "next/link";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

export default function AdminSettingsLayour({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-w-screen min-h-screen bg-slate-900">
      <div className="flex w-full flex-row items-center justify-center p-2 text-xl font-semibold text-white">
        Admin <span className="text-fuchsia-500">Settings</span>
      </div>
      <div className="flex w-full flex-col items-center justify-center gap-1 p-2">
        <div className="flex w-full flex-row justify-center gap-4 rounded-t-lg bg-slate-800 p-2 text-white">
          <motion.span
            className="flex h-full flex-col items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Link
              className={cn(
                "rounded-lg p-2 transition-colors duration-300",
                pathname === "/settings/admin/users" ? "bg-slate-700" : "",
              )}
              href="/settings/admin/users"
            >
              Users
            </Link>
          </motion.span>
          <motion.span
            className="flex h-full flex-col items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Link
              className={cn(
                "rounded-lg p-2 transition-colors duration-300",
                pathname === "/settings/admin/organisations"
                  ? "bg-slate-700"
                  : "",
              )}
              href="/settings/admin/organisations"
            >
              Organisations
            </Link>
          </motion.span>
          <motion.span
            className="flex h-full flex-col items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Link
              className={cn(
                "rounded-lg p-2 transition-colors duration-300",
                pathname === "/settings/admin/jobtypes" ? "bg-slate-700" : "",
              )}
              href="/settings/admin/jobtypes"
            >
              Global Job Types
            </Link>
          </motion.span>
        </div>
        <AnimatePresence mode="wait">{children}</AnimatePresence>
      </div>
    </div>
  );
}
