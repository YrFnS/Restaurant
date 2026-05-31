import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { db } from "@/lib/db";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  let name = "";
  let tagline = "";
  let description = "";

  try {
    const settings = await db.restaurantSettings.findUnique({
      where: { id: "1" },
    });
    name = settings?.nameEn || "";
    tagline = settings?.taglineEn || "";
    description =
      settings?.descriptionEn || `${name} - ${tagline}`;
  } catch {
    // DB not available yet (e.g. during build)
  }

  return {
    title: tagline ? `${name} — ${tagline}` : name,
    description,
    keywords: [
      name,
      "restaurant",
      "dining",
      "order online",
      "reservations",
      "menu",
    ],
    authors: [{ name }],
    icons: {
      icon: "/favicon.ico",
    },
    openGraph: {
      title: name,
      description: tagline
        ? `${tagline} — ${description}`
        : description,
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
