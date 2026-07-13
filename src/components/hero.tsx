"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useRef, useState } from "react";

import acquireImage from "../../public/hero-office/04-acquire.webp";
import diagnoseImage from "../../public/hero-office/02-diagnose.webp";
import enterImage from "../../public/hero-office/01-enter.webp";
import operateImage from "../../public/hero-office/05-operate.webp";
import proveImage from "../../public/hero-office/03-prove.webp";

type Stage = {
  label: string;
  title: string;
  body: string;
  image: StaticImageData;
  alt: string;
  drift: number;
};

const stages: Stage[] = [
  {
    label: "Enter",
    title: "Build the system. Stop being the system.",
    body: "We find where growth breaks, install the acquisition and operating systems, and get the owner out of the day-to-day.",
    image: enterImage,
    alt: "A monumental white colosseum leading to one executive pavilion",
    drift: 0,
  },
  {
    label: "Diagnose",
    title: "Find the move that is costing you growth",
    body: "We audit acquisition, sales, delivery, and retention to isolate the exact bottleneck before changing anything.",
    image: diagnoseImage,
    alt: "A red chess piece trapped on a black-and-white strategy board",
    drift: 1,
  },
  {
    label: "Prove",
    title: "Scale evidence, not guesses",
    body: "We test concepts organically, keep the ones people respond to, then put paid spend behind what proved itself.",
    image: proveImage,
    alt: "Three campaign concepts with one red path continuing toward scale",
    drift: 3,
  },
  {
    label: "Acquire",
    title: "Connect attention to booked calls",
    body: "Calls, DMs, outreach, sales videos, booking, and follow-up work as one connected acquisition path.",
    image: acquireImage,
    alt: "A phone, camera, and appointment book connected by one red line",
    drift: 2,
  },
  {
    label: "Operate",
    title: "The company keeps moving without you",
    body: "Clean data, clear handoffs, defined roles, and automated workflows let the team run the day-to-day.",
    image: operateImage,
    alt: "An empty executive chair with a red path continuing toward the team",
    drift: 1,
  },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function Hero() {
  const [activeStage, setActiveStage] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const sceneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;
    let frame = 0;
    let lastStage = -1;

    const getProgress = () => {
      const rect = section.getBoundingClientRect();
      const distance = section.offsetHeight - window.innerHeight;
      return distance > 0 ? clamp(-rect.top / distance) : 0;
    };

    const render = (progress: number, snap = false) => {
      const journey = clamp(progress) * stages.length;
      const stageIndex = Math.min(stages.length - 1, Math.floor(journey));

      sceneRefs.current.forEach((scene, index) => {
        if (!scene) return;

        if (snap) {
          scene.style.opacity = index === stageIndex ? "1" : "0";
          scene.style.transform = "translate3d(0, 0, 0) scale(1.04)";
          return;
        }

        const local = journey - index;
        const enter = index === 0 ? 1 : clamp(local / 0.2);
        const exit = index === stages.length - 1 ? 1 : 1 - clamp((local - 0.72) / 0.28);
        const visibility = enter * exit;
        const travel = clamp(local);
        const scale = 1.02 + travel * 0.12;
        const shift = 1.4 - travel * 2.8;
        const shiftX = (0.5 - travel) * stages[index].drift;

        scene.style.opacity = visibility.toFixed(3);
        scene.style.transform = `translate3d(${shiftX.toFixed(2)}%, ${shift.toFixed(2)}%, 0) scale(${scale.toFixed(3)})`;
      });

      if (stageIndex !== lastStage) {
        lastStage = stageIndex;
        setActiveStage(stageIndex);
      }

      if (cueRef.current) {
        cueRef.current.style.opacity = progress > 0.025 ? "0" : "1";
      }
    };

    const update = () => {
      const progress = getProgress();

      if (reduced) {
        const nextStage = Math.min(stages.length - 1, Math.floor(progress * stages.length));
        if (nextStage !== lastStage) render(progress, true);
        return;
      }

      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        render(progress);
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
    <section
      ref={sectionRef}
      className="pov-journey"
      aria-label="How Supra Integration builds a repeatable growth system"
    >
      <div className="pov-journey-pin">
        <div className="pov-scenes" aria-hidden="true">
          {stages.map((stage, index) => (
            <div
              key={stage.label}
              ref={(element) => {
                sceneRefs.current[index] = element;
              }}
              className="pov-scene"
              data-scene={stage.label.toLowerCase()}
              style={{ opacity: index === 0 ? 1 : 0 }}
            >
              <Image
                src={stage.image}
                alt=""
                fill
                sizes="100vw"
                preload={index === 0}
                fetchPriority={index === 0 ? "high" : "low"}
                className="pov-scene-image"
              />
            </div>
          ))}
        </div>

        <div className="pov-copy" aria-live="polite">
          {stages.map((stage, index) => (
            <div
              key={stage.label}
              className="pov-copy-stage"
              data-active={activeStage === index ? "true" : "false"}
              aria-hidden={activeStage !== index}
            >
              <p className="pov-eyebrow">
                <span aria-hidden />
                0{index + 1} / {stage.label}
              </p>
              {index === 0 ? <h1>{stage.title}</h1> : <h2>{stage.title}</h2>}
              <p className="pov-body">{stage.body}</p>
              {(index === 0 || index === stages.length - 1) && (
                <a className="pov-cta" href="#contact">
                  Book the audit <span aria-hidden>→</span>
                </a>
              )}
            </div>
          ))}
        </div>

        <div
          className="pov-stage-rail"
          aria-label={`Stage ${activeStage + 1} of ${stages.length}: ${stages[activeStage].label}`}
        >
          {stages.map((stage, index) => (
            <div key={stage.label} data-active={activeStage === index ? "true" : "false"}>
              <span />
              <b>0{index + 1}</b>
              <small>{stage.label}</small>
            </div>
          ))}
        </div>

        <div ref={cueRef} className="pov-cue" aria-hidden>
          Enter the system <span>↓</span>
        </div>

        <p className="sr-only">{stages[activeStage].alt}</p>
      </div>
    </section>
  );
}
