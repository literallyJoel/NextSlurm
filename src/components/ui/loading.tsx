"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function Loading({ className }: { className?: string }) {
  let _className = className;

  if (!className) {
    _className = "h-14 w-14 bg-white";
  }

  if (className && !className.includes("bg")) {
    _className = cn("bg-white", className);
  }

  if (className && !className.includes("h-")) {
    _className = cn("h-14", _className);
  }

  if (className && !className.includes("w-")) {
    _className = cn("w-14", _className);
  }

  return (
    <motion.div
      className={_className}
      animate={{
        scale: [1, 1.4, 1.5, 1.4, 1],
        rotate: [0, 0, 90, 180, 0],
        backgroundColor: [
          "#86198F",
          "#86198F",
          "#FFFFFF",
          "#FFFFFF",
          "#86198F",
        ],
        boxShadow: [
          "0px 0px 0px",
          "0px 0px 0px",
          "0px 0px 5px",
          "0px 0px 5px",
          "0px 0px 0px",
        ],
        borderRadius: ["0%", "0%", "50%", "50%", "0%"],
      }}
      transition={{
        duration: 1.8,
        ease: "easeInOut",
        times: [0, 0.2, 0.5, 0.8, 1],
        repeat: Infinity,
        repeatDelay: 0.2,
      }}
    />
  );
}
