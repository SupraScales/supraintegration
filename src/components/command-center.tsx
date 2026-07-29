"use client";

import { useState } from "react";

const commandViews = [
  {
    id: "lead-flow",
    label: "Lead flow",
    title: "See every opportunity enter the system",
    description:
      "Bring new leads, lead sources, call activity, response times, and pipeline movement into one operating view.",
    signals: ["New leads", "Lead sources", "Response time", "Call activity"],
    output:
      "Leadership sees where demand came from, whether it received a response, and who owns the next action.",
  },
  {
    id: "conversion",
    label: "Conversion",
    title: "See what is moving and what is stalled",
    description:
      "Connect follow-up status, appointments, quotes, callbacks, and missed opportunities to the same customer journey.",
    signals: ["Follow-up status", "Appointments", "Open quotes", "Missed opportunities"],
    output:
      "The team can act on the opportunities that need attention instead of searching across disconnected tools.",
  },
  {
    id: "operations",
    label: "Operations",
    title: "See the work behind the revenue",
    description:
      "Surface assignments, open tasks, handoffs, location activity, and exceptions that need a human decision.",
    signals: ["Team assignments", "Open tasks", "Handoffs", "Location activity"],
    output:
      "Every recurring responsibility has an owner, a status, and a clear escalation path.",
  },
  {
    id: "leadership",
    label: "Leadership",
    title: "See the business without chasing updates",
    description:
      "Combine conversion indicators, revenue signals, system health, and operating priorities into a management view.",
    signals: ["Conversion signals", "Revenue indicators", "System health", "Priority queue"],
    output:
      "Leadership sees what is working, what is at risk, and where the system needs a decision.",
  },
];

export function CommandCenter() {
  const [activeId, setActiveId] = useState(commandViews[0].id);
  const activeView =
    commandViews.find((view) => view.id === activeId) ?? commandViews[0];

  return (
    <section id="command" className="command-center-section">
      <div className="space-section-heading">
        <p className="space-eyebrow">
          <span aria-hidden />
          Business command center
        </p>
        <h2>
          One dashboard. <span>Every important signal.</span>
        </h2>
        <p>
          Disconnected tools hide the handoffs where revenue gets lost. Supra
          brings the company&apos;s lead flow, follow-up, operations, and
          management visibility into one custom operating environment.
        </p>
      </div>

      <div className="command-center-shell">
        <div className="command-center-nav" aria-label="Command center views">
          <p>Explore the operating view</p>
          {commandViews.map((view, index) => (
            <button
              type="button"
              key={view.id}
              aria-pressed={activeId === view.id}
              onClick={() => setActiveId(view.id)}
            >
              <b>VIEW_0{index + 1}</b>
              <span>{view.label}</span>
            </button>
          ))}
        </div>

        <div className="command-center-display" aria-live="polite">
          <div className="command-center-display-head">
            <span>
              <i aria-hidden />
              Representative system view
            </span>
            <b>Configured per business</b>
          </div>

          <div className="command-center-copy">
            <p>{activeView.label}</p>
            <h3>{activeView.title}</h3>
            <span>{activeView.description}</span>
          </div>

          <div className="command-center-diagram">
            <div className="command-center-signals">
              {activeView.signals.map((signal, index) => (
                <div key={signal}>
                  <b>SIG_0{index + 1}</b>
                  <span>{signal}</span>
                </div>
              ))}
            </div>

            <div className="command-center-core" aria-hidden>
              <i />
              <span>Business</span>
              <b>Command Center</b>
            </div>

            <div className="command-center-output">
              <b>Leadership output</b>
              <p>{activeView.output}</p>
            </div>
          </div>

          <p className="command-center-note">
            The dashboard is configured around the company&apos;s actual
            workflows, software, team, and locations—not forced into a generic
            template.
          </p>
        </div>
      </div>
    </section>
  );
}
