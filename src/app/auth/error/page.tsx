"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

export default function error() {
  const queryParams = useSearchParams();
  const error = queryParams.get("error");
  return (
    <Card className="w-5/12 rounded-xl border-none bg-white/70 backdrop-blur-lg">
      <CardHeader>
        <CardTitle>Something went wrong.</CardTitle>
        <CardDescription>An issue occured while logging in.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-red-500">{error}</p>
        <Link href="/api/auth/signin">
          <div className="flex w-full flex-row py-2">
            <motion.div whileHover={{ rotate: 360 }}>
              <Button className="group transform rounded-full transition duration-500 ease-in-out hover:scale-110 hover:bg-fuchsia-600">
                <ChevronLeftIcon className="size-5 text-white transition-colors" />
              </Button>
            </motion.div>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
