"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type StepId = 1 | 2 | 3;

const STEPS: { id: StepId; label: string; href: string }[] = [
  { id: 1, label: "Login", href: "/login" },
  { id: 2, label: "Bucket & Horizon", href: "/setup" },
  { id: 3, label: "Plan", href: "/plan" },
];

const MORE = [
  { label: "My past plans", href: "/history" },
  { label: "Update today's list", href: "/upload" },
];

function routeStep(path: string): StepId | null {
  return STEPS.find((s) => path === s.href)?.id ?? null;
}

/**
 * Progress and navigation. A step is done if it comes before the current one, and locked if the
 * session can't reach it yet (`reached`, from the layout); the step guards still enforce this.
 */
export function Sidebar({ reached, loggedIn }: { reached: StepId; loggedIn: boolean }) {
  const path = usePathname();
  const current = routeStep(path);
  // The layout isn't re-rendered on client navigation, so remember the furthest step we've been on.
  const [seen, setSeen] = useState<StepId>(reached);
  if (current && current > seen) setSeen(current);
  const furthest = Math.max(reached, seen, current ?? 1);

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Basket Planner home">
        <Logo />
        <span>Basket Planner</span>
      </Link>

      <nav className="nav" aria-label="Main">
        <p className="nav-label">Plan a basket</p>
        <ol className="nav-list" aria-label="Progress">
          {STEPS.map((step) => {
            // Done means behind you: before this page's step or, off the flow, before the furthest reachable step.
            const state =
              step.id === current ? "current" : step.id > furthest ? "locked" : step.id < (current ?? furthest) ? "done" : "open";
            // Login is never a useful link once you're logged in.
            const linked = state !== "current" && state !== "locked" && !(step.id === 1 && loggedIn);
            const inner = (
              <>
                <span className="nav-mark" aria-hidden>
                  {state === "done" ? "✓" : step.id}
                </span>
                <span>{step.label}</span>
              </>
            );
            return (
              <li key={step.id}>
                {linked ? (
                  <Link href={step.href} className={`nav-item nav-${state}`}>
                    {inner}
                  </Link>
                ) : (
                  <span
                    className={`nav-item nav-${state}`}
                    aria-current={state === "current" ? "step" : undefined}
                    aria-disabled={state === "locked" || undefined}
                  >
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {loggedIn && (
          <>
            <p className="nav-label">More</p>
            <ul className="nav-list">
              {MORE.map((item) => {
                const active = path === item.href || path.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={active ? "nav-item nav-current" : "nav-item"}
                      aria-current={active ? "page" : undefined}
                    >
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <p className="nav-label">Guide</p>
        <ul className="nav-list">
          <li>
            <Link
              href="/how-it-works"
              className={path === "/how-it-works" ? "nav-item nav-current" : "nav-item"}
              aria-current={path === "/how-it-works" ? "page" : undefined}
            >
              <span>How this site works</span>
            </Link>
          </li>
        </ul>
      </nav>

      <div className="sidebar-foot">
        <div className="note-card">
          <Logo />
          <p>
            Read-only.
            <br />
            Never places orders.
          </p>
        </div>
      </div>
    </aside>
  );
}

/** Two stacked blocks, in the spirit of a basket of lots. */
function Logo() {
  return (
    <svg className="logo" viewBox="0 0 28 32" width="24" height="28" aria-hidden focusable="false">
      <path d="M8 0h12a4 4 0 0 1 4 4v8H12a4 4 0 0 0-4 4z" fill="var(--tan)" />
      <path d="M4 12h20v4a4 4 0 0 1-4 4H8v8a4 4 0 0 1-4 4 4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="var(--ink)" />
    </svg>
  );
}
