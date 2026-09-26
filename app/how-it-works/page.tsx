import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { TourStrip } from "@/components/TourStrip";
import { TOUR, TOUR_IMAGE, tourImage } from "@/lib/tour/screens";

export const metadata: Metadata = { title: "How this site works · Basket Planner" };

/** Public: the whole flow as phone screenshots, left to right. Regenerate with `npm run screenshots`. */
export default function HowItWorksPage() {
  return (
    <>
      <h1>How this site works</h1>
      <p className="lede tour-lede">
        Eight screens, in the order you&apos;d use them. They show the mock Kite account&apos;s sample data, not
        anyone&apos;s real holdings.
      </p>
      <TourStrip>
        {TOUR.map((step, i) => (
          <li key={step.id} className="tour-card" style={{ "--i": i } as CSSProperties}>
            <div className="phone">
              <picture>
                <source srcSet={tourImage(step.id, "dark")} media="(prefers-color-scheme: dark)" />
                <img
                  src={tourImage(step.id, "light")}
                  width={TOUR_IMAGE.width}
                  height={TOUR_IMAGE.height}
                  loading={i < 3 ? "eager" : "lazy"}
                  decoding="async"
                  alt={`Step ${i + 1}: ${step.title}`}
                />
              </picture>
            </div>
            <div className="tour-text">
              <span className="tour-step">Step {i + 1}</span>
              <h2>{step.title}</h2>
              <p className="note">{step.caption}</p>
            </div>
          </li>
        ))}
      </TourStrip>
    </>
  );
}
