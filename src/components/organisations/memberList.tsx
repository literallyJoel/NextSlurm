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
import { useSession } from "next-auth/react";

const columns = (): ColumnDef<{
  id: string | null;
  name: string | null;
  role: number;
}>[] => {
  const session = useSession();
  const organisationId = useSearchParams().get("selected");
  const cols: ColumnDef<{
    id: string | null;
    name: string | null;
    role: number;
  }>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: (cell) => {
        {
          const session = useSession();

          if (session.data?.user.id !== cell.row.original.id) {
            return cell.getValue();
          }

          return (
            <div className="flex flex-row items-center gap-4">
              <div>{cell.getValue() as String}</div>
              <div
                className="w-1/12 
            rounded-lg  bg-fuchsia-800 p-2 text-center text-xs"
              >
                You
              </div>
            </div>
          );
        }
      },
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

        if (row.original.id === session.data?.user.id) {
          return <></>;
        }
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
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
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
              </motion.div>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return cols;
};

const BCrumbs = ({ type }: { type: "admin" | "user" }) => {
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
            className="flex flex-row items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() =>
              router.push(
                type === "admin"
                  ? "/settings/admin/organisations"
                  : "/settings/organiations",
              )
            }
          >
            {type === "admin" ? "All Organisations" : "Your Organisations"}
          </motion.button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-slate-400">
            {organisation && organisation[0]?.name}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default function MemberList({type}: {type: "admin" | "user"}) {
  const organisationId = useSearchParams().get("selected");
  const [members, membersQuery] = api.organisations.getMember.useSuspenseQuery({
    organisationId: organisationId!,
  });

  return (
    <div className="flex w-9/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <Suspense fallback={<div>Loading...</div>}>
        <BCrumbs type={type}/>
        <Table columns={columns()} data={members!} />;
      </Suspense>
    </div>
  );
}
