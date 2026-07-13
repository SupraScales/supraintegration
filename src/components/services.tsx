"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";

type System = {
  number: string;
  label: string;
  title: string;
  description: string;
  outcome: string;
  tags: string[];
  x: string;
  y: string;
  angle: number;
};

const systems: System[] = [
  {
    number: "01",
    label: "Capture",
    title: "AI Receptionist",
    description: "Answers calls and messages, qualifies the lead, handles common questions, and books the next step.",
    outcome: "Fewer inquiries die after hours or between tasks.",
    tags: ["Calls", "SMS", "Booking"],
    x: "-31vw",
    y: "-21vh",
    angle: 214,
  },
  {
    number: "02",
    label: "Outbound",
    title: "AI Outreach Agent",
    description: "Builds approved lists, sends outreach, tracks every touch, and keeps the follow-up cadence moving.",
    outcome: "Outbound no longer depends on someone remembering a spreadsheet.",
    tags: ["Lists", "Email", "DMs"],
    x: "-9vw",
    y: "-31vh",
    angle: 254,
  },
  {
    number: "03",
    label: "Recovery",
    title: "Lead Nurture",
    description: "Re-engages leads that did not answer, did not book, or went cold with approved multi-touch follow-up.",
    outcome: "Every open lead has a next action instead of disappearing.",
    tags: ["SMS", "Email", "Pipeline"],
    x: "23vw",
    y: "-25vh",
    angle: 306,
  },
  {
    number: "04",
    label: "Attention",
    title: "Content + Social Team",
    description: "Plans content, edits short-form video, manages publishing, and records which hooks earn real response.",
    outcome: "Content becomes a repeatable testing system, not random posting.",
    tags: ["Strategy", "Editing", "Publishing"],
    x: "33vw",
    y: "5vh",
    angle: 9,
  },
  {
    number: "05",
    label: "Scale",
    title: "Paid Growth + Search",
    description: "Runs Meta ads, retargeting, local SEO, and search around proven offers with clean tracking.",
    outcome: "Paid spend follows evidence instead of trying to create it.",
    tags: ["Meta", "SEO", "Search"],
    x: "18vw",
    y: "29vh",
    angle: 57,
  },
  {
    number: "06",
    label: "Flow",
    title: "Revenue Operations",
    description: "Keeps CRM stages, quotes, reminders, handoffs, reporting, invoices, and review requests moving.",
    outcome: "The front and back end can carry more demand without breaking.",
    tags: ["CRM", "Handoffs", "Reporting"],
    x: "-13vw",
    y: "31vh",
    angle: 113,
  },
  {
    number: "07",
    label: "Control",
    title: "SOP + Founder Offload",
    description: "Turns the work into checklists, async updates, delegation rules, guardrails, and account alerts.",
    outcome: "The team runs day-to-day work without constant owner intervention.",
    tags: ["SOPs", "Delegation", "Guardrails"],
    x: "-34vw",
    y: "13vh",
    angle: 158,
  },
];

function SystemNode({ system, index, progress }: { system: System; index: number; progress: MotionValue<number> }) {
  const start = 0.01 + index * 0.008;
  const expanded = 0.075 + index * 0.008;

  const x = useTransform(progress, [0, start, expanded], ["0vw", "0vw", system.x]);
  const y = useTransform(progress, [0, start, expanded], ["0vh", "0vh", system.y]);
  const z = useTransform(progress, [0, expanded, 1], [-420, -80, -140]);
  const scale = useTransform(progress, [0, start, expanded, 1], [0.08, 0.08, 0.72, 0.58]);
  const opacity = useTransform(progress, [0, start, expanded, 1], [0, 0, 0.72, 0.58]);
  const counterRotate = useTransform(progress, [0, 0.08, 1], [0, 0, 310]);

  return (
    <motion.div
      className="constellation-node"
      data-side={system.x.startsWith("-") ? "left" : "right"}
      style={{ x, y, z, scale, opacity, rotate: counterRotate }}
    >
      <i className="constellation-star" aria-hidden />
      <div>
        <b>SYS_{system.number}</b>
        <span>{system.title}</span>
      </div>
    </motion.div>
  );
}

function SystemFocus({ system, index, progress }: { system: System; index: number; progress: MotionValue<number> }) {
  const start = 0.12 + index * 0.12;
  const peak = start + 0.035;
  const end = Math.min(0.99, start + 0.1);
  const opacity = useTransform(progress, [Math.max(0, start - 0.025), start, peak, end, Math.min(1, end + 0.025)], [0, 0, 1, 1, 0]);
  const y = useTransform(progress, [start, peak, end], [18, 0, -12]);

  return (
    <motion.div className="constellation-focus" style={{ opacity, y }}>
      <i className="constellation-star" aria-hidden />
      <div>
        <b>SYS_{system.number}</b>
        <span>{system.title}</span>
      </div>
    </motion.div>
  );
}

function SystemDetail({ system, index, progress }: { system: System; index: number; progress: MotionValue<number> }) {
  const start = 0.12 + index * 0.12;
  const peak = start + 0.035;
  const end = Math.min(0.99, start + 0.1);
  const opacity = useTransform(progress, [Math.max(0, start - 0.025), start, peak, end, Math.min(1, end + 0.025)], [0, 0, 1, 1, 0]);
  const y = useTransform(progress, [start, peak, end], [24, 0, -18]);

  return (
    <motion.article className="constellation-detail" style={{ opacity, y }}>
      <div className="constellation-detail-meta"><b>SYS_{system.number}</b><span>{system.label}</span></div>
      <h3>{system.title}</h3>
      <p>{system.description}</p>
      <div className="constellation-tags">{system.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      <div className="constellation-outcome"><b>System outcome</b><span>{system.outcome}</span></div>
    </motion.article>
  );
}

export function Services() {
  const sceneRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });
  const orbitRotate = useTransform(scrollYProgress, [0, 0.08, 1], [0, 0, -310]);
  const coreScale = useTransform(scrollYProgress, [0, 0.035, 0.09, 1], [2.6, 1, 0.72, 0.5]);
  const coreOpacity = useTransform(scrollYProgress, [0, 0.08, 1], [1, 0.78, 0.38]);

  if (reducedMotion) {
    return (
      <section id="agents" className="constellation-static">
        <div className="space-section-heading">
          <p className="space-eyebrow"><span aria-hidden />Seven connected systems</p>
          <h2>Your growth team, deployed as <span>one constellation.</span></h2>
          <p>Each system has a job. Together they move demand from first attention through delivery and retention.</p>
        </div>
        <div className="constellation-static-grid">
          {systems.map((system) => (
            <article key={system.number}>
              <b>SYS_{system.number} / {system.label}</b>
              <h3>{system.title}</h3>
              <p>{system.description}</p>
              <span>{system.outcome}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="agents" ref={sceneRef} className="constellation-journey">
      <div className="constellation-sticky">
        <div className="constellation-heading">
          <p className="space-eyebrow"><span aria-hidden />Scroll / system constellation</p>
          <h2>Every system has a job. <span>Together, they move revenue.</span></h2>
        </div>

        <div className="constellation-viewport" aria-label="Seven connected growth systems">
          <motion.div className="constellation-orbit" style={{ rotate: orbitRotate }}>
            {systems.map((system) => (
              <i
                className="constellation-ray"
                style={{ transform: `rotate(${system.angle}deg)` }}
                key={`ray-${system.number}`}
                aria-hidden
              />
            ))}
            <motion.div className="constellation-core" style={{ scale: coreScale, opacity: coreOpacity }}>
              <i aria-hidden />
              <span>SUPRA</span>
              <b>CORE</b>
            </motion.div>
            {systems.map((system, index) => (
              <SystemNode key={system.number} system={system} index={index} progress={scrollYProgress} />
            ))}
          </motion.div>
        </div>

        {systems.map((system, index) => (
          <SystemFocus key={`focus-${system.number}`} system={system} index={index} progress={scrollYProgress} />
        ))}

        <div className="constellation-details">
          {systems.map((system, index) => (
            <SystemDetail key={system.number} system={system} index={index} progress={scrollYProgress} />
          ))}
        </div>

        <div className="constellation-progress" aria-hidden>
          {systems.map((system) => <i key={system.number} />)}
        </div>
      </div>
    </section>
  );
}
