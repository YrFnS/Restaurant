"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { I18nProvider } from "@/lib/i18n";
import { QueryProvider } from "@/lib/query";
import { useRestaurantStore } from "@/lib/store";

function PersistedStoreHydrator() {
  useEffect(() => {
    void useRestaurantStore.persist.rehydrate();
  }, []);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <I18nProvider>
        <PersistedStoreHydrator />
        <QueryProvider>{children}</QueryProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
