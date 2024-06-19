"use client";
import { ColumnDef } from "@tanstack/react-table";
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
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { api } from "@/trpc/react";
import { Table } from "@/components/table";
import { Suspense } from "react";
import { useRouter } from "next/navigation";

const columns = (): ColumnDef<{ id: string; name: string }>[] => {
  const cols: ColumnDef<{ id: string; name: string }>[] = [
    {
      accessorKey: "name",
      header: "Name",
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const { id } = row.original;
        const router = useRouter();
        return (
          <div className="flex w-full flex-row justify-end">
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
                  <button
                    className="w-full"
                    onClick={() => router.push(`?selected=${id}`)}
                  >
                    <DropdownMenuItem
                      className={cn(
                        "cursor-pointer focus:bg-slate-700 focus:text-white",
                      )}
                    >
                      View Members
                    </DropdownMenuItem>
                  </button>
                  <DropdownMenuSeparator />
                  <button className="w-full">
                    <DropdownMenuItem className="cursor-pointer focus:bg-slate-700 focus:text-white">
                      Rename Organisation
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
          </div>
        );
      },
    },
  ];

  return cols;
};

export default function OrgList() {
  const [organisations, organisationsQuery] =
    api.organisations.get.useSuspenseQuery();
  return (
    <Suspense fallback={<div>Loading!!...</div>}>
      <div className="flex w-9/12 flex-col gap-2 rounded-lg bg-slate-700 p-4">
        <div className="text-xl font-bold text-white">Organisations</div>
        <Table columns={columns()} data={organisations!} />
      </div>
    </Suspense>
  );
}
