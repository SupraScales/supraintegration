"use client";

import { useEffect, useRef } from "react";

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

function resetParticle(p: Particle, w: number, h: number, now: number) {
  p.x = Math.random() * w;
  p.y = Math.random() * h;
  p.speed = Math.random() * 0.12 + 0.06;
  p.opacity = 1;
  p.fadeStart = now + Math.random() * 600 + 100;
  p.fadingOut = false;
  p.height = Math.random() * 2 + 1;
  p.r = 175 + Math.floor(Math.random() * 26);
  p.g = 140 + Math.floor(Math.random() * 28);
}

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
        resetParticle(p, w, h, now);
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
        if (p.y < 0) resetParticle(p, w, h, now);
        if (!p.fadingOut && now > p.fadeStart) p.fadingOut = true;
        if (p.fadingOut) {
          p.opacity -= 0.008;
          if (p.opacity <= 0) resetParticle(p, w, h, now);
        }
        ctx!.fillStyle = `rgba(${p.r},${p.g},76,${(p.opacity * 0.45).toFixed(2)})`;
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
              "linear-gradient(90deg, transparent, rgba(201,168,76,0.08), transparent)",
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
            background: "rgba(201,168,76,0.06)",
          }}
        />
      ))}
    </div>
  );
}
