"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "#services", label: "Services" },
  { href: "#approach", label: "Approach" },
  { href: "#contact", label: "Contact" },
];

function Logo() {
  return (
    <Image
      src="/logo.png"
      alt="Supra Integration"
      width={160}
      height={40}
      className="h-9 w-auto"
      priority
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
    <header className="sticky top-0 z-50 border-b border-gold/[0.06] bg-bg/60 backdrop-blur-2xl backdrop-saturate-150">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          {/* Fallback text logo (hidden when image loads) */}
          <span className="hidden font-display text-lg font-bold tracking-tight">
            <span className="gold-gradient">SUPRA</span>
            <span className="text-fg">INTEGRATION</span>
          </span>
        </Link>

        <div className="hidden items-center gap-8 text-sm tracking-wide text-muted md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="cursor-pointer transition-colors duration-300 hover:text-gold"
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#contact"
          className="hidden cursor-pointer rounded-full border border-gold/20 bg-gold/[0.04] px-6 py-2 text-sm font-medium text-gold transition-all duration-500 hover:border-gold/40 hover:bg-gold/10 md:inline-block"
        >
          Get started
        </a>

        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-0.5 w-6 bg-gold transition-transform duration-300 ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-gold transition-opacity duration-300 ${open ? "opacity-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-6 bg-gold transition-transform duration-300 ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </nav>

      {open && (
        <div className="border-t border-gold/10 bg-bg/95 px-6 pb-6 pt-4 backdrop-blur-2xl md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-muted transition-colors hover:text-gold"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="mt-2 inline-block rounded-full border border-gold/30 bg-gold/[0.06] px-6 py-2 text-sm font-medium text-gold"
          >
            Get started
          </a>
        </div>
      )}
    </header>
  );
}
