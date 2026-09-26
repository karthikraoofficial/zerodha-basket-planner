"use client";

import { useRef } from "react";

/** A horizontal, snap-scrolling list with previous/next buttons that move one card at a time. */
export function TourStrip({ children }: { children: React.ReactNode }) {
  const list = useRef<HTMLOListElement>(null);

  function step(direction: 1 | -1) {
    const el = list.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  }

  return (
    <div className="tour">
      <div className="tour-nav">
        <button type="button" className="tour-arrow" onClick={() => step(-1)} aria-label="Previous screen">
          ←
        </button>
        <button type="button" className="tour-arrow" onClick={() => step(1)} aria-label="Next screen">
          →
        </button>
      </div>
      <ol ref={list} className="tour-strip" tabIndex={0} aria-label="Screens, left to right">
        {children}
      </ol>
    </div>
  );
}
