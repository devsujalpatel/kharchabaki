"use client";

import { motion, MotionConfig } from "motion/react";

type MenuButtonProps = {
  open: boolean;
  onClick: () => void;
};

export function MenuButton({ open, onClick }: MenuButtonProps) {
  return (
    <MotionConfig
      transition={{
        duration: 0.2,
        ease: "easeInOut",
      }}
    >
      <motion.button
        initial={false}
        type="button"
        onClick={onClick}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        animate={open ? "open" : "closed"}
        className="relative h-10 w-10 rounded-md bg-white/0 transition-colors hover:bg-white/20 md:hidden cursor-pointer"
      >
        <motion.span
          style={{
            left: "50%",
            top: "35%",
            x: "-50%",
            y: "-50%",
          }}
          variants={{
            open: {
              rotate: ["0deg", "0deg", "45deg"],
              top: ["35%", "50%", "50%"],
            },
            closed: {
              rotate: ["45deg", "0deg", "0deg"],
              top: ["50%", "50%", "35%"],
            },
          }}
          className="absolute h-0.5 w-5 bg-white"
        />
        <motion.span
          style={{
            left: "50%",
            top: "50%",
            x: "-50%",
            y: "-50%",
          }}
          variants={{
            open: {
              rotate: ["0deg", "0deg", "-45deg"],
            },
            closed: {
              rotate: ["-45deg", "0deg", "0deg"],
            },
          }}
          className="absolute h-0.5 w-5 bg-white"
        />
        <motion.span
          style={{
            left: "calc(50% + 5px)",
            bottom: "35%",
            x: "-50%",
            y: "50%",
          }}
          variants={{
            open: {
              rotate: ["0deg", "0deg", "45deg"],
              left: "50%",
              bottom: ["35%", "50%", "50%"],
            },
            closed: {
              rotate: ["45deg", "0deg", "0deg"],
              left: "calc(50% + 5px)",
              bottom: ["50%", "50%", "35%"],
            },
          }}
          className="absolute h-0.5 w-2.5 bg-white"
        />
      </motion.button>
    </MotionConfig>
  );
}
