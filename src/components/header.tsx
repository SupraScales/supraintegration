"use client";

import { useState } from "react";
import Link from "next/link";

const links = [
  { href: "#agents", label: "Agents" },
  { href: "#system", label: "System" },
  { href: "#protocols", label: "SOPs" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="space-header">
      <nav className="space-nav" aria-label="Primary navigation">
        <Link href="/" className="space-logo">
          <i aria-hidden />
          <span>SUPRA</span>INTEGRATION
        </Link>

        <div className="space-nav-links">
          {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </div>

        <a className="space-nav-cta" href="#contact">Book an audit</a>

        <button
          className="space-menu-button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {open && (
        <div className="space-mobile-menu">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
          ))}
          <a href="#contact" onClick={() => setOpen(false)}>Book an audit</a>
        </div>
      )}
    </header>
  );
}
