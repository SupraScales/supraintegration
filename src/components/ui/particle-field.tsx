"use client";

import { useEffect, useRef } from "react";

type RGB = { r: number; g: number; b: number };

// Single source of truth for the particle colour: the palette token in
// globals.css. Change --color-gold there and the particles follow.
const BASE_COLOR_TOKEN = "--color-gold";

// Per-particle jitter, kept identical to the original hand-tuned ranges:
// red varies across [base.r - 26, base.r], green across [base.g - 28, base.g].
const R_JITTER = 26;
const G_JITTER = 28;

function readTokenRGB(token: string): RGB {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (nums && nums.length >= 3) {
    return { r: +nums[0], g: +nums[1], b: +nums[2] };
  }
  // Last-resort guard so a failed read never crashes the canvas; mirrors the token.
  return { r: 201, g: 168, b: 76 };
}

interface Particle {
  x: number;
  y: number;
  speed: number;
  opacity: number;
  fadeStart: number;
  fadingOut: boolean;
  height: number;
  r: number;
  g: number;
}

function resetParticle(
  p: Particle,
  w: number,
  h: number,
  now: number,
  base: RGB
) {
  p.x = Math.random() * w;
  p.y = Math.random() * h;
  p.speed = Math.random() * 0.12 + 0.06;
  p.opacity = 1;
  p.fadeStart = now + Math.random() * 600 + 100;
  p.fadingOut = false;
  p.height = Math.random() * 2 + 1;
  p.r = base.r - R_JITTER + Math.floor(Math.random() * R_JITTER);
  p.g = base.g - G_JITTER + Math.floor(Math.random() * G_JITTER);
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const base = readTokenRGB(BASE_COLOR_TOKEN);

    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let raf = 0;
    let visible = true;
    let lastFrame = 0;
    const interval = 1000 / 30;

    function resize() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      w = parent.offsetWidth;
      h = parent.offsetHeight;
      canvas!.width = w;
      canvas!.height = h;

      const count = Math.min(Math.floor((w * h) / 16000), 50);
      const now = Date.now();
      particles = [];
      for (let i = 0; i < count; i++) {
        const p = {} as Particle;
        resetParticle(p, w, h, now, base);
        particles.push(p);
      }
    }

    function animate(time: number) {
      raf = requestAnimationFrame(animate);
      if (!visible) return;
      if (time - lastFrame < interval) return;
      lastFrame = time;

      ctx!.clearRect(0, 0, w, h);
      const now = Date.now();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.y -= p.speed;
        if (p.y < 0) resetParticle(p, w, h, now, base);
        if (!p.fadingOut && now > p.fadeStart) p.fadingOut = true;
        if (p.fadingOut) {
          p.opacity -= 0.008;
          if (p.opacity <= 0) resetParticle(p, w, h, now, base);
        }
        ctx!.fillStyle = `rgba(${p.r},${p.g},${base.b},${(p.opacity * 0.45).toFixed(2)})`;
        ctx!.fillRect(p.x, p.y, 0.5, p.height);
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => { visible = entry.isIntersecting; },
      { threshold: 0 }
    );
    observer.observe(canvas);

    resize();
    raf = requestAnimationFrame(animate);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
    />
  );
}

export function AccentLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {[25, 40, 60, 75, 90].map((pct, i) => (
        <div
          key={`h-${i}`}
          className="absolute left-0 right-0 mx-auto h-px"
          style={{
            top: `${pct}%`,
            background:
              "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-gold) 8%, transparent), transparent)",
          }}
        />
      ))}
      {[30, 40, 60, 70].map((pct, i) => (
        <div
          key={`v-${i}`}
          className="absolute top-0 w-px"
          style={{
            left: `${pct}%`,
            height: "100%",
            background: "color-mix(in srgb, var(--color-gold) 6%, transparent)",
          }}
        />
      ))}
    </div>
  );
}
