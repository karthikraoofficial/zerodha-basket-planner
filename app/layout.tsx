import type { Metadata, Viewport } from "next";
import { DISCLAIMER } from "@/lib/disclaimer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basket Planner",
  description: "Read-only basket sizing for a daily ranked list. Not investment advice.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <main className="container">{children}</main>
        <footer className="disclaimer" role="contentinfo">
          {DISCLAIMER}
        </footer>
      </body>
    </html>
  );
}
