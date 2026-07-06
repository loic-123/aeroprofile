import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  delay?: number;
}

export function FadeIn({ children, delay = 0 }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay: delay / 1000,
      }}
    >
      {children}
    </motion.div>
  );
}
