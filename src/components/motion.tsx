"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useHydrated } from "./use-hydrated";

// Reference scroll-reveal curve — design.md §9.1 (primary cubic-bezier).
const revealEase = [0.2, 0.8, 0.2, 1] as const;

export function FadeIn({
  children,
  delay = 0,
  className,
  y = 30,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  if (hydrated && reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: revealEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeInScale({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  if (hydrated && reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: revealEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeInStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  const reduceMotion = hydrated && reduced;
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-10px" }}
      variants={{
        visible: {
          transition: { staggerChildren: reduceMotion ? 0 : 0.08 },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function FadeInItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  if (hydrated && reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 30 },
        visible: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.8,
            ease: revealEase,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SlideInLeft({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const hydrated = useHydrated();
  if (hydrated && reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: revealEase }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export { motion, useReducedMotion };
