"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const steps = [
  {
    label: "Intake",
    icon: "📥",
    detail: "New lead submitted",
    color: "from-accent to-accent/60",
  },
  {
    label: "Route",
    icon: "🔀",
    detail: "Qualified → Sales",
    color: "from-accent/80 to-accent-2/80",
  },
  {
    label: "Done",
    icon: "✓",
    detail: "CRM updated, Slack notified",
    color: "from-accent-2 to-accent-2/60",
  },
];

export function AgentDemo() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [reduced]);

  return (
    <div className="glass mx-auto w-full max-w-sm rounded-2xl p-5">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span className="inline-block h-2 w-2 rounded-full bg-accent-2 shadow-[0_0_6px_rgba(0,212,184,0.5)]" />
        AI Agent — Live
      </div>
      <div className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <motion.div
            key={step.label}
            animate={
              reduced
                ? {}
                : {
                    opacity: i <= active ? 1 : 0.3,
                    scale: i === active ? 1.02 : 1,
                  }
            }
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3"
          >
            <span className="text-lg">{step.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-fg">{step.label}</div>
              <div className="truncate text-xs text-muted">{step.detail}</div>
            </div>
            {i <= active && !reduced && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`h-2 w-2 rounded-full bg-gradient-to-r ${step.color}`}
              />
            )}
            {i <= active && reduced && (
              <div
                className={`h-2 w-2 rounded-full bg-gradient-to-r ${step.color}`}
              />
            )}
          </motion.div>
        ))}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          animate={reduced ? {} : { width: `${((active + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
          style={reduced ? { width: "100%" } : undefined}
        />
      </div>
    </div>
  );
}
