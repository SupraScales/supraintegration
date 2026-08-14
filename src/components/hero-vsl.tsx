"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

const WISTIA_MEDIA_ID = "vhcgrj2jq7";

type WistiaPlayerElement = HTMLElement & {
  play: () => void;
  playerColor: string;
};

function readColorToken(token: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

export function HeroVsl() {
  const playerHostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<WistiaPlayerElement | null>(null);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const host = playerHostRef.current;

    if (!host) {
      return;
    }

    const player = document.createElement("wistia-player") as WistiaPlayerElement;
    player.setAttribute("media-id", WISTIA_MEDIA_ID);
    player.setAttribute("aspect", "1.7777777778");
    player.setAttribute("fit-strategy", "contain");
    player.setAttribute("player-color", readColorToken("--color-red"));
    player.setAttribute("big-play-button", "false");
    player.setAttribute("controls-visible-on-load", "false");
    player.setAttribute("copy-link-and-thumbnail", "false");
    player.setAttribute("playback-rate-control", "false");
    player.setAttribute("settings-control", "false");
    player.setAttribute("player-border-radius", "0");

    const handlePlay = () => setStarted(true);
    const handleEnded = () => setStarted(false);

    player.addEventListener("play", handlePlay);
    player.addEventListener("ended", handleEnded);
    host.replaceChildren(player);
    playerRef.current = player;

    let active = true;

    customElements.whenDefined("wistia-player").then(() => {
      if (!active) {
        return;
      }

      player.playerColor = readColorToken("--color-red");
      setReady(true);
    });

    return () => {
      active = false;
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("ended", handleEnded);
      player.remove();
      playerRef.current = null;
    };
  }, []);

  function playVideo() {
    if (!ready || !playerRef.current) {
      return;
    }

    playerRef.current.play();
  }

  return (
    <div className="hero-vsl-frame">
      <Script
        src={`https://fast.wistia.com/embed/${WISTIA_MEDIA_ID}.js`}
        type="module"
        strategy="afterInteractive"
      />
      <Script
        src="https://fast.wistia.com/player.js"
        strategy="afterInteractive"
      />

      <div className="hero-vsl-head" aria-hidden>
        <span><i />Supra system brief</span>
        <span>05:37 / Playback ready</span>
      </div>

      <div className="hero-vsl-stage">
        <div
          ref={playerHostRef}
          className="hero-vsl-player"
          aria-label="Supra Integration systems overview video"
        />
        <div className={`hero-vsl-overlay${started ? " is-hidden" : ""}`}>
          <button
            type="button"
            className="hero-vsl-play"
            onClick={playVideo}
            disabled={!ready}
            aria-label="Play the Supra Integration systems overview"
          >
            <span className="hero-vsl-play-icon" aria-hidden><i /></span>
            <span className="hero-vsl-play-copy">
              <b>{ready ? "Watch how the system works" : "Loading system brief"}</b>
              <small>05:37 / Full systems breakdown</small>
            </span>
          </button>
        </div>
      </div>

      <div className="hero-vsl-foot" aria-hidden>
        <span>Supra Integration / Systems built to scale</span>
      </div>
    </div>
  );
}
