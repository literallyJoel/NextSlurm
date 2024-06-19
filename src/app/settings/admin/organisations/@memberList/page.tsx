"use client";

import { ColumnDef } from "@tanstack/react-table";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

import { api } from "@/trpc/react";
import { organisations } from "@/server/db/schema";
import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Table } from "@/components/table";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const columns = (): ColumnDef<{
  id: string | null;
  name: string | null;
  role: number;
}>[] => {
  const organisationId = useSearchParams().get("selected");
  const cols: ColumnDef<{
    id: string | null;
    name: string | null;
    role: number;
  }>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      accessorKey: "role",
      header: "User Role",
      cell: (cell) => {
        const { data: user } = api.organisations.getMember.useQuery(
          {
            userId: cell.row.original.id ?? "",
            organisationId: organisationId!,
          },
          {
            enabled: !!organisationId,
          },
        );

        const roleText =
          user && user[0]?.role === 0
            ? "User"
            : user && user[0]?.role === 1
              ? "Moderator"
              : "Admin";

        return (
          <motion.div
            className="flex w-full flex-row  items-center"
            key={`${cell.row.id}-${roleText}`}
            initial={false}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{
              duration: 0.8,
              type: "spring",
              bounce: 0.5,
              stiffness: 200,
              damping: 10,
            }}
          >
            {roleText}
          </motion.div>
        );
      },
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const { data: user } = api.organisations.getMember.useQuery(
          {
            organisationId: organisationId!,
            userId: row.original.id ?? "",
          },
          {
            enabled: !!organisationId,
          },
        );
        const changeRole = api.organisations.updateMember.useMutation();
        const utils = api.useUtils();
        return (
          <DropdownMenu>
            <motion.button whileTap={{ scale: 0.8 }}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </motion.button>

            <DropdownMenuContent
              align="end"
              className="border-none bg-slate-800/90 text-white backdrop-blur-lg"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col"
              >
                <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                <button className="w-full">
                  <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                    Remove user from organisation
                  </DropdownMenuItem>
                </button>
                {user && user[0]?.role !== 0 && (
                  <button
                    onClick={() => {
                      changeRole.mutate(
                        {
                          organisationId: organisationId!,
                          userId: row.original.id!,
                          role: 0,
                        },
                        {
                          onSuccess: () => {
                            utils.organisations.getMember.invalidate({
                              userId: row.original.id!,
                              organisationId: organisationId!,
                            });
                          },
                        },
                      );
                    }}
                    className="w-full"
                  >
                    <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                      Demote to User
                    </DropdownMenuItem>
                  </button>
                )}
                {user && user[0]?.role !== 1 && (
                  <button
                    onClick={() => {
                      changeRole.mutate(
                        {
                          organisationId: organisationId!,
                          userId: row.original.id!,
                          role: 1,
                        },
                        {
                          onSuccess: () => {
                            utils.organisations.getMember.invalidate({
                              userId: row.original.id!,
                              organisationId: organisationId!,
                            });
                          },
                        },
                      );
                    }}
                    className="w-full"
                  >
                    <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                      {user && user[0]?.role === 0
                        ? "Promote to Moderator"
                        : "Demote to Moderator"}
                    </DropdownMenuItem>
                  </button>
                )}
                {user && user[0]?.role !== 2 && (
                  <button
                    onClick={() => {
                      changeRole.mutate(
                        {
                          organisationId: organisationId!,
                          userId: row.original.id!,
                          role: 2,
                        },
                        {
                          onSuccess: () => {
                            utils.organisations.getMember.invalidate({
                              userId: row.original.id!,
                              organisationId: organisationId!,
                            });
                          },
                        },
                      );
                    }}
                    className="w-full"
                  >
                    <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                      Promote to Admin
                    </DropdownMenuItem>
                  </button>
                )}
                <DropdownMenuSeparator />
                <button className="w-full">
                  <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                    View Organisation
                  </DropdownMenuItem>
                </button>

                <button className="w-full">
                  <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                    Delete Organisation
                  </DropdownMenuItem>
                </button>
              </motion.div>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return cols;
};

const BCrumbs = () => {
  const router = useRouter();
  const organisationId = useSearchParams().get("selected");
  const { data: organisation } = api.organisations.get.useQuery(
    { organisationId: organisationId! },
    {
      enabled: !!organisationId,
    },
  );

  return (
    <Breadcrumb className="p-2">
      <BreadcrumbList>
        <BreadcrumbItem>
          <motion.button
            className="flex flex-row items-center justify-center text-fuchsia-500"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => router.push("/settings/admin/organisations")}
          >
            All Organisations
          </motion.button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-slate-400">
            {organisation && organisation[0]?.name}
          </BreadcrumbPage>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-slate-500">
            Organisation Members
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default function MemberList() {
  const organisationId = useSearchParams().get("selected");
  const [members, membersQuery] = api.organisations.getMember.useSuspenseQuery({
    organisationId: organisationId!,
  });

  return (
    <div className="flex w-9/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <BCrumbs />
        <Table columns={columns()} data={members!} />;
      </Suspense>
    </div>
  );
}
