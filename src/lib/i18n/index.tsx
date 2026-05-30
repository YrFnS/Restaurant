"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

type Locale = "en" | "ar";
type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, ar };

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("locale");
  if (saved === "en" || saved === "ar") return saved;
  return "en";
}

interface SettingsOverrides {
  nameEn?: string;
  nameAr?: string;
  taglineEn?: string;
  taglineAr?: string;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  dir: "ltr" | "rtl";
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: en,
  dir: "ltr",
  isRTL: false,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [settingsOverrides, setSettingsOverrides] = useState<SettingsOverrides | null>(null);

  // Fetch restaurant settings once on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = await res.json();
        const s = data.settings;
        if (s) {
          setSettingsOverrides({
            nameEn: s.nameEn,
            nameAr: s.nameAr,
            taglineEn: s.taglineEn,
            taglineAr: s.taglineAr,
          });
        }
      } catch {
        // Fall back to i18n file defaults
      }
    }
    loadSettings();
  }, []);

  // Update document attributes when locale changes
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  const dir = locale === "ar" ? "rtl" : "ltr";
  const isRTL = locale === "ar";

  // Merge settings overrides into translations
  const t = useMemo<Translations>(() => {
    const base = translations[locale];
    if (!settingsOverrides) return base;
    return {
      ...base,
      app: {
        ...base.app,
        name: locale === "ar"
          ? (settingsOverrides.nameAr || base.app.name)
          : (settingsOverrides.nameEn || base.app.name),
        tagline: locale === "ar"
          ? (settingsOverrides.taglineAr || base.app.tagline)
          : (settingsOverrides.taglineEn || base.app.tagline),
      },
    };
  }, [locale, settingsOverrides]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ locale, setLocale, t, dir, isRTL }),
    [locale, setLocale, t, dir, isRTL]
  );

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useTranslation() {
  const { t, locale, isRTL, dir } = useI18n();
  return { t, locale, isRTL, dir };
}
