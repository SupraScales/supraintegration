"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useHydrated } from "./use-hydrated";

type System = {
  number: string;
  label: string;
  title: string;
  description: string;
  outcome: string;
  tags: string[];
  problem: string;
  installed: string;
  human: string;
  autonomous: string;
  dashboard: string;
  x: string;
  y: string;
  angle: number;
};

const systems: System[] = [
  {
    number: "01",
    label: "Capture",
    title: "Autonomous Front Office",
    description: "Calls, inquiries, scheduling, routing, and follow-up working as one controlled system.",
    outcome: "Every inquiry is recorded and given a clear next action.",
    tags: ["Calls", "Intake", "Scheduling", "AI receptionist"],
    problem: "Missed or inconsistently handled inquiries.",
    installed: "Intake, qualification, routing, scheduling, escalation, and conversation logging.",
    human: "Complex, sensitive, and high-value conversations.",
    autonomous: "Routine intake, after-hours capture, reminders, and CRM updates.",
    dashboard: "Calls, outcomes, response time, appointments, and open handoffs.",
    x: "-31vw",
    y: "-21vh",
    angle: 214,
  },
  {
    number: "02",
    label: "Outbound",
    title: "AI Outreach Agent",
    description: "Structured outbound conversations that keep human approval and oversight in the loop.",
    outcome: "Outbound becomes an organized, visible process instead of an unattended spreadsheet.",
    tags: ["SMS", "Email", "Qualification"],
    problem: "Dormant databases and approved lead lists receive inconsistent follow-up.",
    installed: "Messaging rules, campaign cadences, suppression controls, classification, and routing.",
    human: "Approve messaging and handle interested or complex responses.",
    autonomous: "Send scheduled touches, classify replies, create tasks, and route opportunities.",
    dashboard: "Touches, replies, interest, suppressions, appointments, and human escalations.",
    x: "-9vw",
    y: "-31vh",
    angle: 254,
  },
  {
    number: "03",
    label: "Recovery",
    title: "Lead Nurture + Conversion",
    description: "A measurable conversion system that gives every opportunity the right next action.",
    outcome: "Open opportunities keep moving until they convert, decline, or require a human decision.",
    tags: ["Speed to lead", "Quotes", "No-shows"],
    problem: "Good leads disappear after the first call, missed appointment, or open quote.",
    installed: "Speed-to-lead, reminders, callbacks, quote chase, no-show recovery, and long-term nurture.",
    human: "Handle objections, pricing decisions, and high-intent conversations.",
    autonomous: "Trigger timed next actions, reminders, recovery sequences, and handoff tasks.",
    dashboard: "Pipeline age, follow-up status, appointments, quotes, and stalled opportunities.",
    x: "23vw",
    y: "-25vh",
    angle: 306,
  },
  {
    number: "04",
    label: "Visibility",
    title: "Revenue Operations",
    description: "Connect the stages between lead source, first contact, appointment, quote, close, and review.",
    outcome: "Leadership can see where revenue is moving and where it is getting stuck.",
    tags: ["Attribution", "Pipeline", "KPIs"],
    problem: "Revenue leaks between the ad, the call, the quote, and the next team handoff.",
    installed: "Attribution, pipeline stages, ownership rules, conversion tracking, and exception alerts.",
    human: "Close opportunities, set pricing, and resolve exceptions.",
    autonomous: "Capture activity, assign tasks, update stages, and surface missed opportunities.",
    dashboard: "Lead sources, conversion stages, call outcomes, quotes, ownership, and revenue indicators.",
    x: "33vw",
    y: "5vh",
    angle: 9,
  },
  {
    number: "05",
    label: "Attention",
    title: "Content + Social Team",
    description: "Turn company knowledge, proof, and daily operations into a consistent market presence.",
    outcome: "Content becomes a managed demand system instead of random posting.",
    tags: ["Planning", "Repurposing", "Approval"],
    problem: "The company creates useful stories and proof every day, but rarely captures or distributes them consistently.",
    installed: "Input capture, planning, drafting, repurposing, approval, distribution, and performance tracking.",
    human: "Protect the company voice, approve sensitive content, and contribute real expertise.",
    autonomous: "Organize inputs, produce drafts, route approvals, repurpose assets, and schedule configured work.",
    dashboard: "Content queue, approvals, publishing status, performance, and demand contribution.",
    x: "18vw",
    y: "29vh",
    angle: 57,
  },
  {
    number: "06",
    label: "Control",
    title: "Founder Offload",
    description: "Move recurring decisions, follow-up, reporting, and team coordination out of the owner’s head.",
    outcome: "Important work moves without the founder carrying every reminder and handoff.",
    tags: ["SOPs", "Delegation", "Escalation"],
    problem: "The owner remains the memory, task manager, and escalation point for daily work.",
    installed: "SOPs, role ownership, priority queues, approval routing, escalation logic, and weekly reporting.",
    human: "Lead strategy, hiring, relationships, and true exceptions.",
    autonomous: "Route recurring work, assemble reports, monitor deadlines, and surface exceptions.",
    dashboard: "Open tasks, owners, overdue work, approvals, exceptions, and weekly priorities.",
    x: "-13vw",
    y: "31vh",
    angle: 113,
  },
  {
    number: "07",
    label: "Foundation",
    title: "Scale + Transferability",
    description: "Create repeatable processes, organized data, role clarity, and management visibility.",
    outcome: "The business becomes less owner-dependent and better prepared for responsible growth or future transition.",
    tags: ["Standards", "Reporting", "Role clarity"],
    problem: "Growth becomes inconsistent when every location, employee, or decision follows a different process.",
    installed: "Documented workflows, centralized data, management reporting, location standards, and role clarity.",
    human: "Set direction, develop leaders, and make strategic decisions.",
    autonomous: "Run repeatable workflows, monitor consistency, and alert the team to exceptions.",
    dashboard: "Role ownership, location performance, process status, management signals, and system health.",
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
      <div className="constellation-brief">
        <div><b>Problem</b><span>{system.problem}</span></div>
        <div><b>Installed system</b><span>{system.installed}</span></div>
        <div><b>Human role</b><span>{system.human}</span></div>
        <div><b>Autonomous role</b><span>{system.autonomous}</span></div>
        <div><b>Dashboard</b><span>{system.dashboard}</span></div>
      </div>
      <div className="constellation-outcome"><b>System outcome</b><span>{system.outcome}</span></div>
    </motion.article>
  );
}

export function Services() {
  const sceneRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });
  const orbitRotate = useTransform(scrollYProgress, [0, 0.08, 1], [0, 0, -310]);
  const coreScale = useTransform(scrollYProgress, [0, 0.035, 0.09, 1], [2.6, 1, 0.72, 0.5]);
  const coreOpacity = useTransform(scrollYProgress, [0, 0.08, 1], [1, 0.78, 0.38]);

  if (hydrated && reducedMotion) {
    return (
      <section id="agents" className="constellation-static">
        <div className="space-section-heading">
          <p className="space-eyebrow"><span aria-hidden />One command center / seven connected modules</p>
          <h2>One operating environment. <span>Built around your business.</span></h2>
          <p>The command center connects each module from first contact through daily operations and management visibility.</p>
        </div>
        <div className="constellation-static-grid">
          {systems.map((system) => (
            <article key={system.number}>
              <b>SYS_{system.number} / {system.label}</b>
              <h3>{system.title}</h3>
              <p>{system.description}</p>
              <div className="constellation-static-brief">
                <p><b>Problem</b>{system.problem}</p>
                <p><b>Installed system</b>{system.installed}</p>
                <p><b>Human role</b>{system.human}</p>
                <p><b>Autonomous role</b>{system.autonomous}</p>
                <p><b>Dashboard</b>{system.dashboard}</p>
              </div>
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
          <p className="space-eyebrow"><span aria-hidden />Scroll / connected operating modules</p>
          <h2>Seven modules. <span>One command center.</span></h2>
        </div>

        <div className="constellation-viewport" aria-label="Seven modules connected to the business command center">
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
              <span>Business</span>
              <b>Command Center</b>
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
