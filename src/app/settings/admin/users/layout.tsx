"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export default function UserAdminSettingsLayout({
  children,
  userlist,
  createUserForm,
  orgList,
  deleteUser,
}: {
  children: ReactNode;
  userlist: ReactNode;
  createUserForm: ReactNode;
  orgList: ReactNode;
  deleteUser: ReactNode;
}) {
  const params = useSearchParams();
  const selectedUser = params.get("selected");
  const toDelete = params.get("delete");

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: "spring", duration: 1, bounce: 0.6 }}
      className="flex h-[90vh] w-full flex-row gap-1 rounded-b-lg bg-slate-800 p-2"
    >
      {toDelete && deleteUser}
      {selectedUser ? orgList : userlist}
      {createUserForm}
    </motion.div>
  );
}
