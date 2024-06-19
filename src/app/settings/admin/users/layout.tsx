"use client";

import { useSearchParams } from "next/navigation";
import { ReactNode } from "react";
import { motion } from "framer-motion";

export default function UserAdminSettingsLayout({
  children,
  userlist,
  createUserForm,
  orgList,
}: {
  children: ReactNode;
  userlist: ReactNode;
  createUserForm: ReactNode;
  orgList: ReactNode;
}) {
  const params = useSearchParams();
  const selectedUser = params.get("selected");

  return (
    <motion.div
      initial={{ opacity: 0, y: 1000 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 1000 }}
      transition={{ type: "spring", duration: 0.8, bounce: 0.4 }}
      className="flex h-[90vh] w-full flex-row gap-1 rounded-b-lg bg-slate-800 p-2"
    >
      {selectedUser ? orgList: userlist}
      {createUserForm}
    </motion.div>
  );
}
