"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const steps = [
  {
    label: "Intake",
    icon: "📥",
    detail: "New lead captured",
  },
  {
    label: "Qualify",
    icon: "🔀",
    detail: "AI scored → Tier 1",
  },
  {
    label: "Route",
    icon: "⚡",
    detail: "Assigned to Sales",
  },
  {
    label: "Done",
    icon: "✓",
    detail: "CRM + Slack notified",
  },
];

export function AgentDemo() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const interval = setInterval(() => {
      setActive((prev) => (prev + 1) % steps.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [reduced]);

  return (
    <div className="glass gold-glow mx-auto w-full max-w-sm rounded-2xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-gold shadow-[0_0_8px_rgba(201,168,76,0.6)]" />
          AI Agent — Live
        </div>
        <div className="font-mono text-[10px] text-gold/40">supra.agent.v1</div>
      </div>
      <div className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <motion.div
            key={step.label}
            animate={
              reduced
                ? {}
                : {
                    opacity: i <= active ? 1 : 0.25,
                    scale: i === active ? 1.02 : 1,
                  }
            }
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors duration-300 ${
              i === active
                ? "bg-gold/[0.08] border border-gold/20"
                : "bg-white/[0.02] border border-transparent"
            }`}
          >
            <span className="text-base">{step.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-fg">{step.label}</div>
              <div className="truncate text-xs text-muted">{step.detail}</div>
            </div>
            {i < active && (
              <span className="text-xs text-gold">✓</span>
            )}
            {i === active && !reduced && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-2 w-2 rounded-full bg-gold shadow-[0_0_6px_rgba(201,168,76,0.5)]"
              />
            )}
          </motion.div>
        ))}
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          animate={
            reduced ? {} : { width: `${((active + 1) / steps.length) * 100}%` }
          }
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light"
          style={reduced ? { width: "100%" } : undefined}
        />
      </div>
    </div>
  );
}
