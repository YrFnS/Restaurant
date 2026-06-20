import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "POS Terminal — Saffron & Spice",
  description: "Point of Sale terminal for staff. Take tableside orders, manage floor plan, process payments.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f59e0b",
};

export default function PosLayout({ children }: { children: React.ReactNode }) {
  // POS is a full-screen terminal — no app sidebar, no top nav, no footer.
  // We let the page itself own the entire viewport with its own chrome.
  return <div className="pos-shell min-h-screen bg-background text-foreground">{children}</div>;
}
