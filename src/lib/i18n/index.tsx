"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import en from "./locales/en.json";
import ar from "./locales/ar.json";

export type Locale = "en" | "ar";
type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, ar };
const LOCALE_STORAGE_KEY = "rs-locale";
const LOCALE_CHANGE_EVENT = "rs-locale-change";
let sessionLocale: Locale | null = null;

function getBrowserLocaleSnapshot(): Locale {
  if (typeof window === "undefined") return "en";
  if (sessionLocale) return sessionLocale;

  try {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === "en" || saved === "ar") return saved;
  } catch {
    // Storage can be unavailable in hardened/private browser contexts.
  }

  const browserLanguage =
    typeof navigator === "undefined" ? "" : navigator.language.toLowerCase();
  return browserLanguage.startsWith("ar") ? "ar" : "en";
}

function getServerLocaleSnapshot(): Locale {
  return "en";
}

function subscribeToLocale(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  };
}

function persistLocale(locale: Locale) {
  sessionLocale = locale;

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The language still changes for this session when storage is unavailable.
  }

  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: Translations;
  dir: "ltr" | "rtl";
  isRTL: boolean;
  // format helpers
  fmtCurrency: (amount: number) => string;
  fmtDate: (date: Date | string) => string;
  fmtTime: (date: Date | string) => string;
  fmtNumber: (n: number) => string;
  fmtRelative: (date: Date | string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  toggleLocale: () => {},
  t: en,
  dir: "ltr",
  isRTL: false,
  fmtCurrency: (n) => String(n),
  fmtDate: (d) => String(d),
  fmtTime: (d) => String(d),
  fmtNumber: (n) => String(n),
  fmtRelative: (d) => String(d),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore supplies the deterministic server snapshot during
  // hydration, then restores the browser preference after React has attached.
  const locale = useSyncExternalStore(
    subscribeToLocale,
    getBrowserLocaleSnapshot,
    getServerLocaleSnapshot
  );
  const [currency, setCurrency] = useState<string>("USD");
  const [currencySymbol, setCurrencySymbol] = useState<string>("$");

  // Fetch restaurant settings for currency
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) {
          if (data.settings.currency) setCurrency(data.settings.currency);
          if (data.settings.currencySymbol) setCurrencySymbol(data.settings.currencySymbol);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  const setLocale = useCallback((newLocale: Locale) => {
    persistLocale(newLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    persistLocale(locale === "en" ? "ar" : "en");
  }, [locale]);

  const dir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";
  const isRTL = locale === "ar";

  // Formatting helpers — use Western numerals even in Arabic for consistency
  const fmtCurrency = useCallback(
    (amount: number) => {
      try {
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `${currencySymbol}${amount.toFixed(2)}`;
      }
    },
    [currency, currencySymbol]
  );

  const fmtNumber = useCallback((n: number) => {
    try {
      return new Intl.NumberFormat("en-US").format(n);
    } catch {
      return String(n);
    }
  }, []);

  const fmtDate = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      try {
        return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(d);
      } catch {
        return d.toLocaleDateString();
      }
    },
    [locale]
  );

  const fmtTime = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      try {
        return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }).format(d);
      } catch {
        return d.toLocaleTimeString();
      }
    },
    [locale]
  );

  const fmtRelative = useCallback(
    (date: Date | string) => {
      const d = typeof date === "string" ? new Date(date) : date;
      const diff = Date.now() - d.getTime();
      const sec = Math.floor(diff / 1000);
      const min = Math.floor(sec / 60);
      const hr = Math.floor(min / 60);
      const day = Math.floor(hr / 24);
      if (locale === "ar") {
        if (sec < 60) return "الآن";
        if (min < 60) return `منذ ${min} دقيقة`;
        if (hr < 24) return `منذ ${hr} ساعة`;
        return `منذ ${day} يوم`;
      }
      if (sec < 60) return "just now";
      if (min < 60) return `${min}m ago`;
      if (hr < 24) return `${hr}h ago`;
      return `${day}d ago`;
    },
    [locale]
  );

  const t = translations[locale];

  const contextValue = useMemo<I18nContextType>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      t,
      dir,
      isRTL,
      fmtCurrency,
      fmtDate,
      fmtTime,
      fmtNumber,
      fmtRelative,
    }),
    [locale, setLocale, toggleLocale, t, dir, isRTL, fmtCurrency, fmtDate, fmtTime, fmtNumber, fmtRelative]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  return ctx;
}

// Helper to translate with interpolation: t("key", { name: value })
export function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}
