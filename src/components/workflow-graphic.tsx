"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const nodes = [
  { id: "crm", label: "CRM", sub: "connected", x: 60, y: 50, delay: 0.3 },
  { id: "inbox", label: "INBOX", sub: "connected", x: 280, y: 50, delay: 0.5 },
  { id: "slack", label: "SLACK", sub: "notified", x: 60, y: 330, delay: 0.9 },
  { id: "data", label: "DATA", sub: "updated", x: 280, y: 330, delay: 1.1 },
];

const lines = [
  { from: [130, 110], to: [240, 200], delay: 0.6 },
  { from: [350, 110], to: [240, 200], delay: 0.8 },
  { from: [240, 260], to: [150, 350], delay: 1.2 },
  { from: [240, 260], to: [330, 350], delay: 1.4 },
];

function TravelingDot({
  path,
  delay,
  reduced,
}: {
  path: string;
  delay: number;
  reduced: boolean | null;
}) {
  if (reduced) return null;
  return (
    <motion.circle
      r="3"
      fill="#c9a84c"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.9, 0.9, 0] }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      <animateMotion dur="3s" repeatCount="indefinite" begin={`${delay}s`} path={path} />
    </motion.circle>
  );
}

export function WorkflowGraphic() {
  const reduced = useReducedMotion();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setInView(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {/* Ambient glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 -m-12 rounded-full blur-[100px]"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 0.25 } : {}}
        transition={{ duration: 2, ease: "easeOut" }}
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.5) 0%, transparent 70%)",
        }}
      />

      <svg
        viewBox="0 0 480 440"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative h-auto w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(201,168,76,0.6)" />
            <stop offset="100%" stopColor="rgba(201,168,76,0.15)" />
          </linearGradient>
          <filter id="node-glow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="center-glow">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Connecting lines — draw on */}
        {lines.map((l, i) => (
          <motion.line
            key={i}
            x1={l.from[0]}
            y1={l.from[1]}
            x2={l.to[0]}
            y2={l.to[1]}
            stroke="url(#line-grad)"
            strokeWidth="1.5"
            strokeDasharray="8 6"
            initial={reduced ? {} : { pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{
              pathLength: { duration: 1.2, delay: l.delay, ease: [0.25, 0.1, 0.25, 1] },
              opacity: { duration: 0.4, delay: l.delay },
            }}
          />
        ))}

        {/* Outer nodes */}
        {nodes.map((n) => (
          <motion.g
            key={n.id}
            initial={reduced ? {} : { opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{
              duration: 0.8,
              delay: n.delay,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ transformOrigin: `${n.x + 70}px ${n.y + 40}px` }}
          >
            <rect
              x={n.x}
              y={n.y}
              width="140"
              height="80"
              rx="16"
              fill="rgba(201,168,76,0.04)"
              stroke="rgba(201,168,76,0.25)"
              strokeWidth="1"
            />
            <text
              x={n.x + 70}
              y={n.y + 36}
              textAnchor="middle"
              fill="#c9a84c"
              fontSize="14"
              fontWeight="600"
              fontFamily="var(--font-display)"
              letterSpacing="0.08em"
            >
              {n.label}
            </text>
            <text
              x={n.x + 70}
              y={n.y + 56}
              textAnchor="middle"
              fill="rgba(201,168,76,0.4)"
              fontSize="11"
              fontFamily="var(--font-display)"
            >
              {n.sub}
            </text>
          </motion.g>
        ))}

        {/* Center node: AI Agent */}
        <motion.g
          initial={reduced ? {} : { opacity: 0, scale: 0.7 }}
          animate={inView ? { opacity: 1, scale: 1 } : {}}
          transition={{
            duration: 1,
            delay: 0.1,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ transformOrigin: "240px 230px" }}
        >
          {/* Outer glow ring */}
          <motion.rect
            x="162"
            y="182"
            width="156"
            height="96"
            rx="22"
            fill="none"
            stroke="rgba(201,168,76,0.15)"
            strokeWidth="1"
            animate={reduced ? {} : { strokeOpacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Main card */}
          <rect
            x="170"
            y="190"
            width="140"
            height="80"
            rx="18"
            fill="rgba(201,168,76,0.08)"
          />
          <motion.rect
            x="170"
            y="190"
            width="140"
            height="80"
            rx="18"
            fill="none"
            stroke="rgba(201,168,76,0.5)"
            strokeWidth="1.5"
            animate={reduced ? {} : { strokeOpacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <text
            x="240"
            y="226"
            textAnchor="middle"
            fill="#c9a84c"
            fontSize="16"
            fontWeight="700"
            fontFamily="var(--font-display)"
            letterSpacing="0.1em"
          >
            AI AGENT
          </text>
          <text
            x="240"
            y="250"
            textAnchor="middle"
            fill="rgba(201,168,76,0.4)"
            fontSize="11"
            fontFamily="var(--font-display)"
          >
            processing
          </text>
          {/* Pulse dot */}
          <motion.circle
            cx="302"
            cy="198"
            r="4"
            fill="#c9a84c"
            animate={reduced ? {} : { opacity: [0.9, 0.3, 0.9], r: [4, 6, 4] as number[] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.g>

        {/* Traveling dots */}
        <TravelingDot path="M130,110 L240,200" delay={1.8} reduced={reduced} />
        <TravelingDot path="M350,110 L240,200" delay={2.3} reduced={reduced} />
        <TravelingDot path="M240,260 L150,350" delay={2.8} reduced={reduced} />
        <TravelingDot path="M240,260 L330,350" delay={3.3} reduced={reduced} />
      </svg>
    </div>
  );
}
