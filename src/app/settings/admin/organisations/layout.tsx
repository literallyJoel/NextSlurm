"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export default function OrganisationAdminSettingsLayout({
  children,
  orgList,
  createOrgForm,
  memberList,
  addMemberForm,
  renameOrgForm,
  deleteOrg,
}: {
  children: ReactNode;
  orgList: ReactNode;
  createOrgForm: ReactNode;
  memberList: ReactNode;
  addMemberForm: ReactNode;
  renameOrgForm: ReactNode;
  deleteOrg: ReactNode;
}) {
  const params = useSearchParams();
  const selectedOrganisation = params.get("selected");
  const toDelete = params.get("delete");
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 100 }}
      transition={{ type: "spring", duration: 1, bounce: 0.6 }}
      className="flex h-[90vh] w-full flex-row gap-1 rounded-b-lg bg-slate-800 p-2"
    >
      {toDelete && deleteOrg}
      {selectedOrganisation ? memberList : orgList}
      {selectedOrganisation ? (
        <div className="flex w-3/12 flex-col justify-between gap-1">
          {addMemberForm} {renameOrgForm}
        </div>
      ) : (
        createOrgForm
      )}
    </motion.div>
  );
}
