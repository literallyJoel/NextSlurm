"use client";
import { motion } from "framer-motion";
import Link from "next/link";

const Logo = () => {
  return (
    <Link href="/">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="min-w-full text-lg font-bold"
      >
        Web<span className="text-fuchsia-600">Slurm</span>
      </motion.button>
    </Link>
  );
};

export default Logo;
