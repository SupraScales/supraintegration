"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "#agents", label: "Agents" },
  { href: "#system", label: "System" },
  { href: "#protocols", label: "SOPs" },
];

function Logo() {
  return (
    <Image
      src="/logo.png"
      alt="Supra Integration"
      width={160}
      height={40}
      className="h-9 w-auto"
      preload
      onError={(e) => {
        const target = e.currentTarget;
        target.style.display = "none";
        const fallback = target.nextElementSibling;
        if (fallback instanceof HTMLElement) fallback.style.display = "flex";
      }}
    />
  );
}

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-rule-soft bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          {/* Fallback text logo (hidden when image loads) */}
          <span className="hidden font-display text-lg font-bold uppercase tracking-[0.04em] text-ink">
            SUPRA<span className="text-ink-mid">INTEGRATION</span>
          </span>
        </Link>

        <div className="hidden items-center gap-9 font-mono text-[0.78rem] font-medium uppercase tracking-[0.15em] text-ink-soft md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="cursor-pointer transition-colors duration-200 hover:text-red"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#contact"
          className="hidden cursor-pointer border border-ink bg-ink px-6 py-2.5 font-display text-[0.78rem] font-medium uppercase tracking-[0.08em] text-paper-raised transition-colors duration-200 hover:border-red hover:bg-red md:inline-block"
        >
          Book an audit
        </a>

        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 bg-ink transition-transform duration-200 ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-ink transition-opacity duration-200 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-ink transition-transform duration-200 ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {open && (
        <div className="border-t border-rule-soft bg-paper px-6 pb-6 pt-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 font-mono text-[0.78rem] font-medium uppercase tracking-[0.15em] text-ink-soft transition-colors duration-200 hover:text-red"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-3 inline-block border border-ink bg-ink px-6 py-2.5 font-display text-[0.78rem] font-medium uppercase tracking-[0.08em] text-paper-raised transition-colors duration-200 hover:border-red hover:bg-red"
          >
            Book an audit
          </a>
        </div>
      )}
    </header>
  );
}
