import { motion } from "framer-motion";
import Image, { StaticImageData } from "next/image";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

interface props {
  name: string;
  img: StaticImageData;
  toggleProvider: (provider: string) => void;
  providers: string[];
}

export function ProviderBttn({ name, img, toggleProvider, providers }: props) {
  return (
    <motion.button
      onClick={() => toggleProvider(name)}
      whileHover={{ scale: 1.1 }}
      className="z-1 relative flex w-full flex-col items-center justify-center gap-2 rounded-lg bg-slate-900 p-4"
    >
      <motion.div
        className="absolute -right-2 -top-2"
        key={name}
        initial={false}
        animate={providers.includes(name) ? { scale: 1 } : { scale: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
      >
        <CheckCircleIcon className="z-100 size-6 rounded-full bg-white text-green-500" />
      </motion.div>

      <Image src={img} width={70} height={70} alt={name} />
      <div className="font-semibold text-white">{name}</div>
    </motion.button>
  );
}
