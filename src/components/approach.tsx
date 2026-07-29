"use client";

import { useRef, type CSSProperties } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useHydrated } from "./use-hydrated";

const layers = [
  {
    number: "01",
    label: "Audit",
    title: "Find the constraint",
    body: "Trace demand, sales, fulfillment, and retention. Find the exact handoff where leads stall, customers drop, or the owner gets pulled back in.",
    output: "A clear order of operations",
  },
  {
    number: "02",
    label: "Prove",
    title: "Test before scaling",
    body: "Put offers, hooks, and content in front of the market at low cost. Record the response and keep what earns attention and action.",
    output: "Evidence for what to scale",
  },
  {
    number: "03",
    label: "Deploy",
    title: "Connect the revenue path",
    body: "Install calls, DMs, outreach, sales video, booking, CRM, nurture, and reporting as one coordinated system.",
    output: "Fewer manual handoffs",
  },
  {
    number: "04",
    label: "Operate",
    title: "Make the work repeatable",
    body: "Add simple SOPs, ownership rules, health alerts, async updates, and management visibility so the team can run it.",
    output: "Less founder dependence",
  },
];

function LayerDetail({ layer, index, progress }: { layer: (typeof layers)[number]; index: number; progress: MotionValue<number> }) {
  const ranges = [
    { start: 0, center: 0.05, end: 0.2 },
    { start: 0.22, center: 0.36, end: 0.5 },
    { start: 0.52, center: 0.67, end: 0.81 },
    { start: 0.83, center: 0.95, end: 1 },
  ];
  const { start, center, end } = ranges[index];
  const opacityRanges = [
    { input: [0, 0.12, 0.22, 1], output: [1, 1, 0, 0] },
    { input: [0, 0.2, 0.3, 0.43, 0.53, 1], output: [0, 0, 1, 1, 0, 0] },
    { input: [0, 0.5, 0.6, 0.73, 0.83, 1], output: [0, 0, 1, 1, 0, 0] },
    { input: [0, 0.8, 0.9, 1], output: [0, 0, 1, 1] },
  ];
  const opacity = useTransform(
    progress,
    opacityRanges[index].input,
    opacityRanges[index].output,
  );
  const y = useTransform(progress, [start, center, end], [24, 0, -18]);

  return (
    <motion.article className="layer-detail" style={{ opacity, y }}>
      <p><span aria-hidden />Layer {layer.number} / {layer.label}</p>
      <h3>{layer.title}</h3>
      <div>{layer.body}</div>
      <b>Output</b>
      <strong>{layer.output}</strong>
    </motion.article>
  );
}

export function Approach() {
  const sceneRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ["start start", "end end"],
  });
  const ringRotate = useTransform(scrollYProgress, [0, 1], [0, -270]);
  const ringTilt = useTransform(scrollYProgress, [0, 0.5, 1], [-8, 5, -8]);

  if (hydrated && reducedMotion) {
    return (
      <section id="system" className="layer-static">
        <div className="space-section-heading">
          <p className="space-eyebrow"><span aria-hidden />How the system is built</p>
          <h2>Four layers. One <span>operating system.</span></h2>
        </div>
        <div className="layer-static-grid">
          {layers.map((layer) => (
            <article key={layer.number}>
              <b>{layer.number} / {layer.label}</b>
              <h3>{layer.title}</h3>
              <p>{layer.body}</p>
              <span>{layer.output}</span>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section id="system" ref={sceneRef} className="layer-journey">
      <div className="layer-sticky">
        <div className="layer-heading">
          <p className="space-eyebrow"><span aria-hidden />Scroll / operating orbit</p>
          <h2>Random tactics become one <span>operating system.</span></h2>
          <p>Each layer turns toward you in the order it has to be built.</p>
        </div>

        <div className="layer-detail-stack">
          {layers.map((layer, index) => (
            <LayerDetail key={layer.number} layer={layer} index={index} progress={scrollYProgress} />
          ))}
        </div>

        <div className="layer-stage" aria-hidden>
          <div className="layer-axis" />
          <motion.div className="layer-ring" style={{ rotateY: ringRotate, rotateX: ringTilt }}>
            {layers.map((layer, index) => (
              <article
                className="layer-face"
                style={{ "--layer-angle": `${index * 90}deg` } as CSSProperties}
                key={layer.number}
              >
                <b>{layer.number}</b>
                <span>{layer.label}</span>
                <i />
              </article>
            ))}
          </motion.div>
          <div className="layer-core"><i /><span>OPERATING</span><b>LAYER</b></div>
        </div>

        <div className="layer-index" aria-hidden>
          {layers.map((layer) => <span key={layer.number}>{layer.number}</span>)}
        </div>
      </div>
    </section>
  );
}
