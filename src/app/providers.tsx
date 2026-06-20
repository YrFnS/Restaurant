"use client";

import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
import { QueryProvider } from "@/lib/query";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <I18nProvider>
        <QueryProvider>{children}</QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
