"use client";

import { ColumnDef } from "@tanstack/react-table";
import type { User } from "next-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/trpc/react";
import { cn } from "@/lib/utils";
import { Table } from "@/components/table";
import { useRouter } from "next/navigation";

import { useSession } from "next-auth/react";
import Loading from "@/components/ui/loading";

// Column Definitions
const columns = (): ColumnDef<User & { role: number }>[] => [
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
              className="min-w-1/12 
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
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: (cell) => {
      const { data: user } = api.users.get.useQuery({
        userId: cell.row.original.id,
      });
      const roleText = user && user[0]?.role === 0 ? "User" : "Admin";
      return (
        <motion.div
          className="flex w-full flex-row items-center"
          key={`${cell.row.id}-${roleText}`}
          initial={{ scale: 0 }}
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
          <div>{roleText}</div>
        </motion.div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const router = useRouter();
      const changeUserRole = api.users.update.useMutation();
      const utils = api.useUtils();
      const { id } = row.original;
      const { data: user } = api.users.get.useQuery({ userId: id });
      const session = useSession();
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
              {session.data?.user.id !== row.original.id && (
                <>
                  <button
                    className="w-full"
                    onClick={() =>
                      router.push(`?delete=${id}&name=${row.original.name}`)
                    }
                  >
                    <DropdownMenuItem className="cursor-pointer text-red-500 focus:bg-slate-700 focus:text-red-500">
                      Delete User
                    </DropdownMenuItem>
                  </button>
                  <DropdownMenuSeparator />

                  <button className="w-full">
                    <DropdownMenuItem
                      onClick={() => {
                        changeUserRole.mutate(
                          {
                            userId: id,
                            role: user && user[0] && user[0].role === 0 ? 1 : 0,
                          },
                          {
                            onSuccess: (user) =>
                              utils.users.get.invalidate({ userId: user?.id }),
                          },
                        );
                      }}
                      className="cursor-pointer focus:bg-slate-700 focus:text-white"
                    >
                      {user && user[0]?.role === 0
                        ? "Promote to Admin"
                        : "Demote to User"}
                    </DropdownMenuItem>
                  </button>
                </>
              )}

              <button className="w-full">
                <DropdownMenuItem
                  className={cn(
                    "cursor-pointer focus:bg-slate-700 focus:text-white",
                  )}
                  onClick={() => router.push(`?selected=${row.original.id}`)}
                >
                  View Organisations
                </DropdownMenuItem>
              </button>
            </motion.div>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];

export default function Userlist() {
  const { data: users, isLoading } = api.users.get.useQuery();

  if (isLoading) {
    return <Loading />;
  }
  return (
    <div className="flex w-9/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
      <div className="text-xl font-bold text-white">Users</div>
      <Table columns={columns()} data={users!} />
    </div>
  );
}
