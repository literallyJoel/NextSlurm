"use client";
import { useState, useRef, useEffect } from "react";
import { motion, Variants } from "framer-motion";
import Image from "next/image";
import DefaultProfile from "@/app/_assets/img/profile/default.jpg";
import { api } from "@/trpc/react";
import { signOut, useSession } from "next-auth/react";

import Link from "next/link";
const itemVariants: Variants = {
  open: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
  closed: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

export default function UserToolbarBttn() {
  const session = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const { data: organisations } = api.users.getOrganisations.useQuery({
    role: 2,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (session && session.data) {
    return (
      <motion.nav
        initial={false}
        animate={isOpen ? "open" : "closed"}
        className="flex w-2/12 flex-col items-center justify-center gap-2 p-2"
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Image
            height={30}
            width={30}
            className="rounded-full"
            src={session.data.user.image ?? DefaultProfile}
            alt="profile"
          />
        </motion.button>

        <motion.ul
          className="absolute top-16 flex w-2/12 flex-col items-center gap-2 bg-slate-700 p-1"
          ref={dropdownRef}
          variants={{
            open: {
              clipPath: "inset(0% 0% 0% 0% round 10px)",
              transition: {
                type: "spring",
                bounce: 0,
                duration: 0.7,
                delayChildren: 0.3,
                staggerChildren: 0.05,
              },
            },
            closed: {
              clipPath: "inset(10% 50% 90% 50% round 10px)",
              transition: {
                type: "spring",
                bounce: 0,
                duration: 0.3,
              },
            },
          }}
        >
          {session.data.user.role === 1 && (
            <Link href="/settings/admin/users">
              <motion.button
                className="w-full rounded-lg p-1 text-center transition-colors hover:bg-slate-400/20"
                variants={itemVariants}
              >
                Admin Settings
              </motion.button>
            </Link>
          )}
          {organisations && organisations.length !== 0 && (
            <motion.button
              className="w-full rounded-lg p-1 text-center transition-colors hover:bg-slate-400/20"
              variants={itemVariants}
            >
              Organisation Settings
            </motion.button>
          )}

          <motion.button
            className="w-full rounded-lg p-1 text-center transition-colors hover:bg-slate-400/20"
            variants={itemVariants}
            onClick={() => {
              signOut({ callbackUrl: "/" });
            }}
          >
            Logout
          </motion.button>
        </motion.ul>
      </motion.nav>
    );
  } else return <></>;
}
