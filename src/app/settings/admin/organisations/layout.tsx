"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export default function OrganisationAdminSettingsLayout({
  children,
  orgList,
  createOrgForm,
  memberList
}: {
  children: ReactNode;
  orgList: ReactNode;
  createOrgForm: ReactNode;
  memberList: ReactNode;
}) {
  const params = useSearchParams();
  const selectedOrganisation = params.get("selected");

  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: "spring", duration: 1, bounce: 0.6 }}
      className="flex h-[90vh] w-full flex-row gap-1 rounded-b-lg bg-slate-800 p-2"
    >
      {selectedOrganisation ? memberList : orgList}
      {createOrgForm}
    </motion.div>
  );
}
