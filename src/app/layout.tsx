import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";
import { db } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
