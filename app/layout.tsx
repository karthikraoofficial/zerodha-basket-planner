import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Sidebar, type StepId } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { DISCLAIMER } from "@/lib/disclaimer";
import { currentSession } from "@/lib/server/guards";
import { requiredRedirect } from "@/lib/session/sessions";
import "./globals.css";

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Basket Planner",
  description: "Read-only basket sizing for a daily ranked list. Not investment advice.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const current = await currentSession();
  // The furthest step the session can reach; the step guards still enforce it on every page.
  const reached: StepId = !current ? 1 : requiredRedirect(current.session, 3) ? 2 : 3;
  return (
    <html lang="en-IN" className={sans.variable}>
      <body>
        <div className="shell">
          <Sidebar reached={reached} loggedIn={Boolean(current)} />
          <main className="shell-main">
            <TopBar loggedIn={Boolean(current)} />
            {children}
          </main>
        </div>
        <footer className="disclaimer" role="contentinfo">
          {DISCLAIMER}
        </footer>
      </body>
    </html>
  );
}
