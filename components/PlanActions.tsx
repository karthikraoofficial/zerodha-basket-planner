"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Plan } from "@/lib/plan/build";
import { planToCsv, planToTsv } from "@/lib/plan/export";

const STALE_AFTER_MS = 15 * 60 * 1000;

function fetchedTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

/** "Fetched at" with a stale warning after 15 minutes, Refresh, and exports. */
export function PlanActions({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const stale = now - Date.parse(plan.accountFetchedAt) > STALE_AFTER_MS;

  async function copy() {
    try {
      await navigator.clipboard.writeText(planToTsv(plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([planToCsv(plan)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `basket-${plan.screenDate}-${plan.horizon}-${plan.bucketPaise / 100}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="actions">
      <span className={stale ? "fetched fetched-stale" : "fetched"}>
        Holdings &amp; cash fetched {fetchedTime(plan.accountFetchedAt)} IST
        {stale && " · stale, refresh before acting"}
      </span>
      <div className="action-buttons">
        <button className="button button-quiet" onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <button className="button button-quiet" onClick={copy} disabled={!plan.positions.length}>
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="button button-quiet" onClick={download} disabled={!plan.positions.length}>
          Download CSV
        </button>
      </div>
    </div>
  );
}
