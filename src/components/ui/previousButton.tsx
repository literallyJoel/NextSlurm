import { motion } from "framer-motion";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

export default function PreviousButton({
  type,
  onClick,
}: {
  className?: string;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
}) {
  return (
    <motion.button
      className="group transform rounded-full  bg-slate-900 p-2 transition-colors duration-500 ease-in-out hover:scale-110 hover:bg-fuchsia-600"
      onClick={onClick}
      type={type}
      whileHover={{ rotate: 360 }}
    >
      <ChevronLeftIcon className="size-5 text-white transition-colors" />
    </motion.button>
  );
}
