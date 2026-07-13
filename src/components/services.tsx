import {
  Clapperboard,
  ListChecks,
  Megaphone,
  PhoneCall,
  RefreshCw,
  Send,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { FadeIn } from "./motion";

type Agent = {
  number: string;
  label: string;
  title: string;
  description: string;
  outcome: string;
  tags: string[];
  visual: "reception" | "outreach" | "nurture" | "content" | "paid" | "ops" | "sops";
  Icon: LucideIcon;
};

const agents: Agent[] = [
  {
    number: "01",
    label: "Capture",
    title: "AI Receptionist",
    description:
      "Answers inbound calls and messages, handles common questions, qualifies the lead, and books the next step.",
    outcome: "Fewer calls and inquiries die after hours or between tasks.",
    tags: ["Calls", "SMS", "Scheduling", "CRM"],
    visual: "reception",
    Icon: PhoneCall,
  },
  {
    number: "02",
    label: "Outbound",
    title: "AI Outreach Agent",
    description:
      "Builds approved prospect lists, sends outreach, tracks every touch, and keeps the follow-up cadence moving.",
    outcome: "Outbound stops depending on someone remembering a spreadsheet.",
    tags: ["Lists", "Email", "SMS", "DMs"],
    visual: "outreach",
    Icon: Send,
  },
  {
    number: "03",
    label: "Recovery",
    title: "Lead Nurture",
    description:
      "Re-engages leads that did not answer, did not book, or went cold with approved multi-touch follow-up.",
    outcome: "Every open lead has a next action instead of disappearing.",
    tags: ["No response", "Reactivation", "Reminders", "Pipeline"],
    visual: "nurture",
    Icon: RefreshCw,
  },
  {
    number: "04",
    label: "Attention",
    title: "Content + Social Team",
    description:
      "Plans content packages, edits short-form video, manages publishing, and records which hooks earn real response.",
    outcome: "Content becomes a repeatable testing system, not random posting.",
    tags: ["Strategy", "Short-form", "Editing", "Publishing"],
    visual: "content",
    Icon: Clapperboard,
  },
  {
    number: "05",
    label: "Scale",
    title: "Paid Growth + Search",
    description:
      "Runs Meta ads, retargeting, local SEO, and search around proven offers with clean tracking and clear guardrails.",
    outcome: "Paid spend follows evidence instead of trying to create it.",
    tags: ["Meta ads", "Retargeting", "SEO", "Search"],
    visual: "paid",
    Icon: Megaphone,
  },
  {
    number: "06",
    label: "Flow",
    title: "Revenue Operations",
    description:
      "Keeps CRM stages, quoting, reminders, handoffs, reporting, invoices, and review requests moving consistently.",
    outcome: "The front end and back end can carry more demand without breaking.",
    tags: ["CRM", "Quotes", "Handoffs", "Reporting"],
    visual: "ops",
    Icon: Workflow,
  },
  {
    number: "07",
    label: "Control",
    title: "SOP + Founder Offload",
    description:
      "Turns the work into simple checklists, async updates, delegation rules, onboarding guardrails, and account alerts.",
    outcome: "The team can run the day-to-day without constant owner intervention.",
    tags: ["SOPs", "Delegation", "Async updates", "Guardrails"],
    visual: "sops",
    Icon: ListChecks,
  },
];

function VisualHeader({ id, name }: { id: string; name: string }) {
  return (
    <div className="agent-visual-head">
      <span>{id} / Live module</span>
      <b><span className="status-dot" aria-hidden /> {name}</b>
    </div>
  );
}

function AgentVisual({ agent }: { agent: Agent }) {
  if (agent.visual === "reception") {
    return (
      <div className="agent-visual">
        <VisualHeader id="CAP_01" name="Reception" />
        <div className="call-signal"><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="visual-table">
          <div><span>Inbound call</span><b>Answered</b></div>
          <div><span>After-hours inquiry</span><b>Qualified</b></div>
          <div><span>New lead</span><b>Booking sent</b></div>
        </div>
      </div>
    );
  }

  if (agent.visual === "outreach") {
    return (
      <div className="agent-visual">
        <VisualHeader id="OUT_02" name="Sequence" />
        <div className="sequence-flow">
          {["List built", "Touch 01", "Follow-up", "Reply routed"].map((step, index) => (
            <div key={step}><b>0{index + 1}</b><span>{step}</span><i /></div>
          ))}
        </div>
        <div className="visual-command">Next action assigned <span>→</span></div>
      </div>
    );
  }

  if (agent.visual === "nurture") {
    return (
      <div className="agent-visual">
        <VisualHeader id="NUR_03" name="Recovery" />
        <div className="nurture-line">
          {["No answer", "SMS", "Email", "Booked"].map((step, index) => (
            <div key={step} data-active={index === 3 ? "true" : "false"}><i /><b>{step}</b><span>0{index + 1}</span></div>
          ))}
        </div>
        <div className="visual-table compact">
          <div><span>Open leads</span><b>Tracked</b></div>
          <div><span>Next touch</span><b>Queued</b></div>
        </div>
      </div>
    );
  }

  if (agent.visual === "content") {
    return (
      <div className="agent-visual">
        <VisualHeader id="CON_04" name="Creative test" />
        <div className="content-frames">
          {["Hook A", "Hook B", "Winner"].map((label, index) => (
            <div key={label} data-winner={index === 2 ? "true" : "false"}>
              <span>{label}</span><i /><i /><i />
            </div>
          ))}
        </div>
        <div className="visual-command">Organic signal recorded <span>→ Paid queue</span></div>
      </div>
    );
  }

  if (agent.visual === "paid") {
    return (
      <div className="agent-visual">
        <VisualHeader id="SCL_05" name="Demand" />
        <div className="signal-bars">
          <div><span>Organic proof</span><i data-level="high" /></div>
          <div><span>Meta</span><i data-level="mid" /></div>
          <div><span>Search</span><i data-level="low" /></div>
          <div><span>Retargeting</span><i data-level="mid" /></div>
        </div>
        <div className="visual-table compact">
          <div><span>Offer signal</span><b>Ready</b></div>
          <div><span>Tracking</span><b>Connected</b></div>
        </div>
      </div>
    );
  }

  if (agent.visual === "ops") {
    return (
      <div className="agent-visual">
        <VisualHeader id="OPS_06" name="Revenue flow" />
        <div className="ops-pipeline">
          {["New", "Qualified", "Quoted", "Won", "Active"].map((step, index) => (
            <div key={step} data-current={index === 2 ? "true" : "false"}><b>0{index + 1}</b><span>{step}</span></div>
          ))}
        </div>
        <div className="visual-command">Handoff health <span>All stages visible</span></div>
      </div>
    );
  }

  return (
    <div className="agent-visual">
      <VisualHeader id="CTL_07" name="Operating rules" />
      <div className="sop-list">
        {["Lead response", "Client onboarding", "Weekly reporting", "Delegation handoff"].map((item, index) => (
          <div key={item}><b>0{index + 1}</b><span>{item}</span><i>Ready</i></div>
        ))}
      </div>
      <div className="visual-command">Owner required <span>By exception only</span></div>
    </div>
  );
}

export function Services() {
  return (
    <section id="agents" className="agents-section">
      <div className="agents-intro">
        <p className="section-kicker">The deployed team</p>
        <h2>Your growth team, installed as <span>one system.</span></h2>
        <p>
          Not another dashboard for you to learn. We build the agents, connect the
          tools, and put the work into production.
        </p>
      </div>

      <div className="agent-stack">
        {agents.map((agent) => (
          <FadeIn key={agent.title}>
            <article className="agent-row">
              <div className="agent-copy">
                <div className="agent-meta"><span>AGT_{agent.number}</span><b>{agent.label}</b></div>
                <agent.Icon aria-hidden strokeWidth={1.5} />
                <h3>{agent.title}</h3>
                <p>{agent.description}</p>
                <div className="agent-tags">
                  {agent.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="agent-outcome"><b>System outcome</b><span>{agent.outcome}</span></div>
              </div>
              <AgentVisual agent={agent} />
            </article>
          </FadeIn>
        ))}
      </div>

      <FadeIn>
        <div className="full-package">
          <div>
            <p className="section-kicker">Full growth package</p>
            <h3>One partner. The entire revenue path.</h3>
            <p>Use the modules you need now, or connect the full system from attention through retention.</p>
          </div>
          <div className="package-modules" aria-label="Full package modules">
            {["Acquisition", "Content", "Paid media", "Sales", "Operations", "SOPs"].map((item, index) => (
              <span key={item}><b>0{index + 1}</b>{item}</span>
            ))}
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
