"use client";

import { useState } from "react";
import Link from "next/link";

const links = [
  { href: "#services", label: "Services" },
  { href: "#approach", label: "Approach" },
  { href: "#contact", label: "Contact" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-[68px] max-w-[1080px] items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Supra<span className="text-accent">Integration</span>
        </Link>

        <div className="hidden items-center gap-7 text-[0.95rem] text-muted md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#contact"
          className="hidden rounded-[10px] bg-gradient-to-br from-accent to-accent-2 px-5 py-2.5 text-[0.95rem] font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-90 md:inline-block"
        >
          Get started
        </a>

        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 bg-fg transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-fg transition-opacity ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-fg transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {open && (
        <div className="border-t border-border bg-bg px-6 pb-6 pt-4 md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-muted transition-colors hover:text-fg"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-2 inline-block rounded-[10px] bg-gradient-to-br from-accent to-accent-2 px-5 py-2.5 text-[0.95rem] font-semibold text-white"
          >
            Get started
          </a>
        </div>
      )}
    </header>
  );
}
