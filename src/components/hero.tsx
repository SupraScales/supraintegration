"use client";

import { useEffect, useRef, useState } from "react";

const LEAK_TOTAL = 18_400;

const nodes = [
  { id: "inbound", label: "Inbound call", detail: "Missed after 5pm", x: 120, y: 280 },
  { id: "intake", label: "Lead intake", detail: null, x: 300, y: 170 },
  { id: "quote", label: "Quote", detail: "Manual, 2 days", x: 500, y: 110 },
  { id: "followup", label: "Follow-up", detail: "Never sent", x: 450, y: 330 },
  { id: "schedule", label: "Schedule", detail: null, x: 700, y: 180 },
  { id: "dispatch", label: "Dispatch", detail: null, x: 720, y: 390 },
  { id: "invoice", label: "Invoice", detail: null, x: 930, y: 300 },
  { id: "review", label: "Review", detail: "Never asked", x: 300, y: 500 },
] as const;

type NodeId = (typeof nodes)[number]["id"];

const edges = [
  { id: "inbound-intake", from: "inbound", to: "intake", d: "M120 280 Q185 190 300 170" },
  { id: "inbound-followup", from: "inbound", to: "followup", d: "M120 280 Q260 400 450 330" },
  { id: "intake-quote", from: "intake", to: "quote", d: "M300 170 Q390 95 500 110" },
  { id: "followup-quote", from: "followup", to: "quote", d: "M450 330 Q420 220 500 110" },
  { id: "quote-schedule", from: "quote", to: "schedule", d: "M500 110 Q600 110 700 180" },
  { id: "followup-dispatch", from: "followup", to: "dispatch", d: "M450 330 Q590 320 720 390" },
  { id: "schedule-dispatch", from: "schedule", to: "dispatch", d: "M700 180 Q760 270 720 390" },
  { id: "dispatch-invoice", from: "dispatch", to: "invoice", d: "M720 390 Q830 420 930 300" },
  { id: "invoice-review", from: "invoice", to: "review", d: "M930 300 Q700 540 300 500" },
  { id: "review-followup", from: "review", to: "followup", d: "M300 500 Q330 390 450 330" },
] as const;

const agents = [
  { id: "call-agent", label: "Call agent", target: "inbound", x: 54, y: 194, threshold: 0 },
  { id: "quote-agent", label: "Quote agent", target: "quote", x: 600, y: 46, threshold: 0.22 },
  { id: "follow-agent", label: "Follow-up agent", target: "followup", x: 540, y: 474, threshold: 0.44 },
  { id: "review-agent", label: "Review agent", target: "review", x: 148, y: 542, threshold: 0.66 },
] as const;

const stages = [
  {
    label: "Audit",
    title: "We map how the business actually runs",
    body: "Calls, leads, quotes, follow-up, scheduling, dispatch, invoices, and reviews—every handoff goes on the map.",
  },
  {
    label: "Diagnose",
    title: "Then we find where revenue leaks",
    body: "Missed calls after hours. Quotes that take two days. Follow-ups nobody sends. Reviews nobody asks for.",
  },
  {
    label: "Deploy",
    title: "Agents go into the broken handoffs",
    body: "They work inside the tools already in use, taking over the repeatable work without adding another system to learn.",
  },
  {
    label: "Live",
    title: "One connected system, running end to end",
    body: "The repaired flow carries each job from first call through invoice and review. The owner can see what is moving and what needs attention.",
  },
] as const;

type RoutePoint = {
  t: number;
  node: NodeId;
  x: number;
  y: number;
  zoom: number;
  edge?: (typeof edges)[number]["id"];
};

const route: RoutePoint[] = [
  { t: 0, node: "inbound", x: 120, y: 280, zoom: 1.55 },
  { t: 0.1, node: "intake", x: 300, y: 170, zoom: 1.78, edge: "inbound-intake" },
  { t: 0.22, node: "quote", x: 500, y: 110, zoom: 1.95, edge: "intake-quote" },
  { t: 0.31, node: "followup", x: 450, y: 330, zoom: 2.08, edge: "followup-quote" },
  { t: 0.38, node: "inbound", x: 120, y: 280, zoom: 2.12, edge: "inbound-followup" },
  { t: 0.44, node: "followup", x: 450, y: 330, zoom: 2.12, edge: "inbound-followup" },
  { t: 0.5, node: "review", x: 300, y: 500, zoom: 2.08, edge: "review-followup" },
  { t: 0.57, node: "invoice", x: 930, y: 300, zoom: 1.92, edge: "invoice-review" },
  { t: 0.62, node: "dispatch", x: 720, y: 390, zoom: 2, edge: "dispatch-invoice" },
  { t: 0.67, node: "schedule", x: 700, y: 180, zoom: 2.02, edge: "schedule-dispatch" },
  { t: 0.72, node: "quote", x: 500, y: 110, zoom: 2.05, edge: "quote-schedule" },
  { t: 0.76, node: "followup", x: 450, y: 330, zoom: 2.02, edge: "followup-quote" },
  { t: 0.84, node: "dispatch", x: 720, y: 390, zoom: 1.82, edge: "followup-dispatch" },
  { t: 0.9, node: "invoice", x: 930, y: 300, zoom: 1.72, edge: "dispatch-invoice" },
  { t: 0.95, node: "review", x: 300, y: 500, zoom: 1.58, edge: "invoice-review" },
  { t: 1, node: "followup", x: 540, y: 300, zoom: 1.22, edge: "review-followup" },
];

const leakIds = new Set<NodeId>(["inbound", "quote", "followup", "review"]);
const reducedStageProgress = [0.12, 0.42, 0.7, 0.94];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function ease(amount: number) {
  const t = clamp(amount);
  return 1 - Math.pow(1 - t, 3);
}

function findRouteSegment(progress: number) {
  const nextIndex = route.findIndex((point) => point.t >= progress);
  const toIndex = nextIndex <= 0 ? 1 : nextIndex === -1 ? route.length - 1 : nextIndex;
  const fromIndex = toIndex - 1;
  const from = route[fromIndex];
  const to = route[toIndex];
  const local = clamp((progress - from.t) / (to.t - from.t));

  return { from, to, fromIndex, toIndex, local: ease(local) };
}

function formatMoney(value: number) {
  return `$${Math.round(value / 100) * 100}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function Hero() {
  const [activeStage, setActiveStage] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<SVGGElement>(null);
  const meterRef = useRef<HTMLDivElement>(null);
  const meterLabelRef = useRef<HTMLSpanElement>(null);
  const meterValueRef = useRef<HTMLSpanElement>(null);
  const cueRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<NodeId, SVGGElement>());
  const edgeRefs = useRef(new Map<string, SVGPathElement>());
  const agentRefs = useRef(new Map<string, SVGGElement>());
  const agentEdgeRefs = useRef(new Map<string, SVGPathElement>());

  useEffect(() => {
    const section = sectionRef.current;
    const svg = svgRef.current;
    const camera = cameraRef.current;
    if (!section || !svg || !camera) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;
    let frame = 0;
    let lastStage = -1;

    const setData = (element: Element, name: string, value: string) => {
      if ((element as HTMLElement).dataset[name] !== value) {
        (element as HTMLElement).dataset[name] = value;
      }
    };

    const renderProgress = (rawProgress: number) => {
      const progress = clamp(rawProgress);
      const stageIndex = Math.min(3, Math.floor(progress * 4));
      const stageLocal = clamp(progress * 4 - stageIndex);
      const segment = findRouteSegment(progress);
      const x = mix(segment.from.x, segment.to.x, segment.local);
      const y = mix(segment.from.y, segment.to.y, segment.local);
      const mobileBoost = window.innerWidth < 700 ? 1.18 : 1;
      const zoom = mix(segment.from.zoom, segment.to.zoom, segment.local) * mobileBoost;
      const currentNode = segment.local < 0.5 ? segment.from.node : segment.to.node;

      camera.setAttribute(
        "transform",
        `translate(500 280) scale(${zoom.toFixed(3)}) translate(${-x.toFixed(1)} ${-y.toFixed(1)})`,
      );

      setData(svg, "stage", String(stageIndex));
      if (stageIndex !== lastStage) {
        lastStage = stageIndex;
        setActiveStage(stageIndex);
      }

      const activeEdge = progress < 0.02 ? "" : segment.to.edge ?? "";
      edgeRefs.current.forEach((path, id) => {
        setData(path, "active", id === activeEdge && stageIndex < 3 ? "true" : "false");

        if (stageIndex === 0) {
          const index = edges.findIndex((edge) => edge.id === id);
          const draw = clamp((progress / 0.25 - index * 0.055) * 1.75);
          path.style.strokeDashoffset = String(1 - draw);
        } else if (path.style.strokeDashoffset !== "0") {
          path.style.strokeDashoffset = "0";
        }
      });

      const liveReset = progress > 0.965;
      nodes.forEach((node, nodeIndex) => {
        const element = nodeRefs.current.get(node.id);
        if (!element) return;

        const isFrom = node.id === segment.from.node;
        const isTo = node.id === segment.to.node;
        const routeIndex = route.findIndex((point, index) => index > segment.toIndex && point.node === node.id);
        const wasPassed = route.slice(0, segment.fromIndex + 1).some((point) => point.node === node.id);
        const returnsLater = routeIndex !== -1;
        let scale = 0.9;
        let opacity = returnsLater ? 0.72 : wasPassed ? 0.38 : 0.68;
        let fall = wasPassed ? 24 : 0;

        if (isFrom) {
          scale = mix(1.18, 0.72, segment.local);
          opacity = mix(1, 0.38, segment.local);
          fall = mix(0, 26, segment.local);
        }
        if (isTo) {
          scale = mix(0.9, 1.18, segment.local);
          opacity = 1;
          fall = 0;
        }
        if (liveReset) {
          scale = 1;
          opacity = 1;
          fall = 0;
        }

        if (stageIndex === 0) {
          const reveal = clamp((progress / 0.25 - nodeIndex * 0.065 + 0.45) * 2.2);
          opacity *= reveal;
        }

        element.setAttribute(
          "transform",
          `translate(${node.x} ${(node.y + fall).toFixed(1)}) scale(${scale.toFixed(3)})`,
        );
        element.style.opacity = opacity.toFixed(3);
        setData(element, "current", node.id === currentNode ? "true" : "false");

        let status = "normal";
        if (leakIds.has(node.id) && stageIndex === 1) status = "leak";
        if (leakIds.has(node.id) && stageIndex === 2) {
          const agent = agents.find((item) => item.target === node.id);
          status = agent && stageLocal > agent.threshold + 0.18 ? "fixed" : "leak";
        }
        if (leakIds.has(node.id) && stageIndex === 3) status = "fixed";
        if (stageIndex === 0 && node.id === currentNode) status = "active";
        setData(element, "status", status);
      });

      agents.forEach((agent) => {
        const element = agentRefs.current.get(agent.id);
        const connector = agentEdgeRefs.current.get(agent.id);
        if (!element || !connector) return;

        const visibility = stageIndex < 2 ? 0 : stageIndex === 3 ? 1 : clamp((stageLocal - agent.threshold) * 3.4);
        element.style.opacity = visibility.toFixed(3);
        connector.style.opacity = visibility.toFixed(3);
        element.setAttribute(
          "transform",
          `translate(${agent.x} ${(agent.y + (1 - visibility) * 16).toFixed(1)})`,
        );
        connector.style.strokeDashoffset = String(1 - visibility);
        setData(connector, "fixed", stageIndex === 3 || stageLocal > agent.threshold + 0.18 ? "true" : "false");
      });

      const meter = meterRef.current;
      const meterLabel = meterLabelRef.current;
      const meterValue = meterValueRef.current;
      if (meter && meterLabel && meterValue) {
        const visible = stageIndex > 0;
        setData(meter, "visible", visible ? "true" : "false");
        if (stageIndex < 2) {
          meterLabel.textContent = "Revenue leaking / mo";
          meterValue.textContent = formatMoney(stageIndex === 0 ? 0 : LEAK_TOTAL * stageLocal);
          setData(meter, "mode", "leak");
        } else {
          meterLabel.textContent = "Revenue recovered / mo";
          meterValue.textContent = formatMoney(stageIndex === 2 ? LEAK_TOTAL * stageLocal : LEAK_TOTAL);
          setData(meter, "mode", "recovered");
        }
      }

      if (cueRef.current) {
        cueRef.current.style.opacity = progress > 0.025 ? "0" : "1";
      }
    };

    const getProgress = () => {
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      return distance > 0 ? clamp(-rect.top / distance) : 0;
    };

    const update = () => {
      if (reduced) {
        const stageIndex = Math.min(3, Math.floor(getProgress() * 4));
        if (stageIndex !== lastStage) renderProgress(reducedStageProgress[stageIndex]);
        return;
      }

      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        renderProgress(getProgress());
      });
    };

    const onMotionChange = (event: MediaQueryListEvent) => {
      reduced = event.matches;
      lastStage = -1;
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      update();
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    motionQuery.addEventListener("change", onMotionChange);
    update();

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      motionQuery.removeEventListener("change", onMotionChange);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <section ref={sectionRef} className="system-journey" aria-label="How Supra Integration repairs a business system">
      <div className="system-journey-pin">
        <div className="system-journey-readout">
          <div className="system-journey-copy" aria-live="polite">
            {stages.map((stage, index) => (
              <div
                key={stage.label}
                className="system-journey-card"
                data-active={activeStage === index ? "true" : "false"}
                aria-hidden={activeStage !== index}
              >
                <p className="system-journey-eyebrow">
                  <span aria-hidden />
                  Step 0{index + 1} · {stage.label}
                </p>
                {index === 0 ? (
                  <h1>{stage.title}</h1>
                ) : (
                  <h2>{stage.title}</h2>
                )}
                <p className="system-journey-body">{stage.body}</p>
                {(index === 0 || index === 3) && (
                  <a className="system-journey-cta" href="#contact">
                    Book the audit <span aria-hidden>→</span>
                  </a>
                )}
              </div>
            ))}
          </div>

          <div
            ref={meterRef}
            className="system-journey-meter"
            data-visible="false"
            data-mode="leak"
            aria-hidden={activeStage === 0}
          >
            <span ref={meterLabelRef} className="system-journey-meter-label">Revenue leaking / mo</span>
            <span ref={meterValueRef} className="system-journey-meter-value">$0</span>
            <span className="system-journey-meter-note">Modeled from the system audit</span>
          </div>
        </div>

        <div className="system-map-frame">
          <svg
            ref={svgRef}
            className="system-map"
            viewBox="0 0 1000 560"
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label="A business system map moving from audit through diagnosis, agent deployment, and live operation"
            data-stage="0"
          >
            <g className="system-map-grid" aria-hidden>
              {Array.from({ length: 11 }, (_, index) => (
                <line key={`v-${index}`} x1={index * 100} y1="0" x2={index * 100} y2="560" />
              ))}
              {Array.from({ length: 7 }, (_, index) => (
                <line key={`h-${index}`} x1="0" y1={index * 100} x2="1000" y2={index * 100} />
              ))}
            </g>

            <g ref={cameraRef} className="system-map-camera">
              <g aria-hidden>
                {edges.map((edge) => (
                  <path
                    key={edge.id}
                    ref={(element) => {
                      if (element) edgeRefs.current.set(edge.id, element);
                      else edgeRefs.current.delete(edge.id);
                    }}
                    className="map-edge"
                    data-active="false"
                    d={edge.d}
                    pathLength="1"
                  />
                ))}
              </g>

              <g className="map-live-flow" aria-hidden>
                {edges.map((edge, index) => (
                  <path
                    key={`flow-${edge.id}`}
                    className="map-live-edge"
                    d={edge.d}
                    pathLength="1"
                    style={{ animationDelay: `${-index * 0.13}s` }}
                  />
                ))}
              </g>

              <g aria-hidden>
                {agents.map((agent) => {
                  const target = nodes.find((node) => node.id === agent.target)!;
                  return (
                    <path
                      key={`connector-${agent.id}`}
                      ref={(element) => {
                        if (element) agentEdgeRefs.current.set(agent.id, element);
                        else agentEdgeRefs.current.delete(agent.id);
                      }}
                      className="map-agent-edge"
                      data-fixed="false"
                      d={`M${agent.x} ${agent.y} L${target.x} ${target.y}`}
                      pathLength="1"
                    />
                  );
                })}
              </g>

              <g>
                {nodes.map((node) => (
                  <g
                    key={node.id}
                    ref={(element) => {
                      if (element) nodeRefs.current.set(node.id, element);
                      else nodeRefs.current.delete(node.id);
                    }}
                    className="map-node"
                    data-current="false"
                    data-status="normal"
                    transform={`translate(${node.x} ${node.y})`}
                  >
                    <rect x="-65" y="-22" width="130" height="44" />
                    <text className="map-node-label" textAnchor="middle" y="4">{node.label.toUpperCase()}</text>
                    {node.detail && (
                      <text className="map-node-detail" textAnchor="middle" y="42">{node.detail.toUpperCase()}</text>
                    )}
                  </g>
                ))}
              </g>

              <g>
                {agents.map((agent) => (
                  <g
                    key={agent.id}
                    ref={(element) => {
                      if (element) agentRefs.current.set(agent.id, element);
                      else agentRefs.current.delete(agent.id);
                    }}
                    className="map-agent"
                    transform={`translate(${agent.x} ${agent.y})`}
                  >
                    <rect x="-55" y="-16" width="110" height="32" />
                    <line x1="-55" y1="-16" x2="-55" y2="16" />
                    <text textAnchor="middle" y="3">{agent.label.toUpperCase()}</text>
                  </g>
                ))}
              </g>
            </g>
          </svg>

          <div ref={cueRef} className="system-journey-cue" aria-hidden>
            Scroll to enter the system <span>↓</span>
          </div>

          <div className="system-journey-progress" aria-label={`Stage ${activeStage + 1} of 4: ${stages[activeStage].label}`}>
            {stages.map((stage, index) => (
              <span key={stage.label} data-active={activeStage === index ? "true" : "false"} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
