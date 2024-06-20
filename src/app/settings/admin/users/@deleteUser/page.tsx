"use client";
import { api } from "@/trpc/react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";

export default function DeleteUserModal() {
  //The modal only shows if the param is present, so we just cast to a string
  const userToDelete = useSearchParams().get("delete") as string;
  const userName = useSearchParams().get("name") as string;
  const deleteUser = api.users.delete.useMutation();
  const router = useRouter();
  const utils = api.useUtils();
  return (
    <div className="absolute left-0 top-0 z-10 flex h-full w-full flex-row items-center justify-center p-6 backdrop-blur">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.4 }}
        exit={{ scale: 0, opacity: 0 }}
        className="top-4/12 mb-24 flex h-1/4 w-1/2 flex-col items-center gap-2 rounded-lg bg-slate-900 p-12"
      >
        <span className="text-2xl font-bold text-white">
          Are you sure you want to delete {userName}?
        </span>
        <span className="text-xl font-bold text-red-400">
          This cannot be undone.
        </span>
        <div className="flex-rowitems-center mt-auto flex w-full justify-center gap-4">
          <motion.button
            whileHover={{
              scale: 1.1,
              backgroundColor: "#C43E3E",
              color: "#7A1A1A",
            }}
            whileTap={{ scale: 0.9 }}
            className="w-4/12 rounded-lg bg-red-400 p-2 text-white"
            onClick={() =>
              deleteUser.mutate(
                { userId: userToDelete },
                {
                  onSuccess: () => {
                    utils.users.get.invalidate();
                    router.push("/settings/admin/users");
                  },
                },
              )
            }
          >
            Delete
          </motion.button>
          <motion.button
            whileHover={{
              scale: 1.05,
            }}
            whileTap={{ scale: 0.9 }}
            className="w-4/12 rounded-lg bg-slate-500 p-2 text-white"
            onClick={() => router.push("/settings/admin/users")}
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
