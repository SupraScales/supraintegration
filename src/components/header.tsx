"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const links = [
  { href: "#agents", label: "Agents" },
  { href: "#system", label: "System" },
  { href: "#protocols", label: "SOPs" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const logoVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    function syncLogoMotion() {
      const video = logoVideoRef.current;
      if (!video) return;

      if (motionPreference.matches) {
        video.pause();
        video.currentTime = 0;
        return;
      }

      void video.play().catch(() => undefined);
    }

    syncLogoMotion();
    motionPreference.addEventListener("change", syncLogoMotion);
    return () => motionPreference.removeEventListener("change", syncLogoMotion);
  }, []);

  return (
    <header className="space-header">
      <nav className="space-nav" aria-label="Primary navigation">
        <Link href="/" className="space-logo">
          <video
            ref={logoVideoRef}
            className="space-logo-mark"
            muted
            loop
            playsInline
            poster="/supra-logo.jpg"
            preload="metadata"
            aria-hidden
          >
            <source src="/supra-logo-nav.webm" type="video/webm" />
            <source src="/supra-logo-nav.mp4" type="video/mp4" />
          </video>
          <span className="space-logo-text"><b>SUPRA</b>INTEGRATION</span>
        </Link>

        <div className="space-nav-links">
          {links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}
        </div>

        <div className="space-nav-actions">
          <Link className="space-nav-login" href="/login">
            <span aria-hidden />
            Client login
          </Link>
          <a className="space-nav-cta" href="#contact">Book an audit</a>
        </div>

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
          <Link href="/login" onClick={() => setOpen(false)}>Client login</Link>
          <a href="#contact" onClick={() => setOpen(false)}>Book an audit</a>
        </div>
      )}
    </header>
  );
}
