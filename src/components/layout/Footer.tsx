"use client";

import React, { useState, useEffect } from "react";
import {
  ChefHat,
  MapPin,
  Phone,
  Mail,
  Instagram,
  Facebook,
  Twitter,
  Clock,
  Send,
  Heart,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";

export function Footer() {
  const { t, locale, isRTL } = useI18n();
  const settings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);

  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const restaurantName =
    settings && locale === "ar" ? settings.nameAr : settings?.nameEn ?? t.app.name;
  const address =
    settings && locale === "ar" ? settings.addressAr : settings?.addressEn ?? "";
  const phone = settings?.phone ?? "";
  const email = settings?.email ?? "";
  const openTime = settings?.openTime ?? "";
  const closeTime = settings?.closeTime ?? "";

  const socialLinks = [
    {
      icon: Instagram,
      label: "Instagram",
      href: settings?.instagramUrl || "",
    },
    {
      icon: Facebook,
      label: "Facebook",
      href: settings?.facebookUrl || "",
    },
    {
      icon: Twitter,
      label: "Twitter",
      href: settings?.twitterUrl || "",
    },
  ].filter((link) => link.href);

  const year = new Date().getFullYear();

  const formatHour = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setNewsletterLoading(true);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(t.footer.subscribedSuccess);
        setNewsletterEmail("");
      } else if (data.message === "Already subscribed") {
        toast.info(t.footer.alreadySubscribed);
        setNewsletterEmail("");
      } else {
        toast.error(t.footer.subscribeError);
      }
    } catch {
      toast.error(t.footer.subscribeError);
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <footer className="mt-auto border-t border-border bg-gradient-to-b from-amber-50/50 to-orange-50/50 dark:from-amber-950/10 dark:to-orange-950/10">
      {/* Desktop Footer */}
      <div className="hidden md:block">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 gap-8">
            {/* Column 1: Restaurant Info */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
                  <ChefHat className="size-5 text-white" />
                </div>
                <span className="font-bold text-foreground text-lg">{restaurantName}</span>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <span>{address}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{phone}</span>
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Operating Hours & Social */}
            <div className="flex flex-col gap-4">
              {/* Operating Hours */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="size-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-semibold text-foreground">{t.footer.hours}</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {openTime && closeTime ? (
                    <div className="flex items-center justify-between">
                      <span>{t.footer.monday} - {t.footer.sunday}</span>
                      <span className="font-medium text-foreground">{formatHour(openTime)} - {formatHour(closeTime)}</span>
                    </div>
                  ) : (
                    <div className="text-muted-foreground/60">{t.common.loading}</div>
                  )}
                </div>
              </div>

              {/* Social Links */}
              <div>
                <span className="text-sm font-medium text-foreground">{t.footer.followUs}</span>
                <div className="flex items-center gap-2.5 mt-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="size-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                      aria-label={link.label}
                    >
                      <link.icon className="size-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 3: Newsletter */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-foreground">{t.footer.newsletter}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.footer.newsletterDesc}
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <Input
                  type="email"
                  placeholder={t.footer.emailPlaceholder}
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  className="text-sm h-9"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={newsletterLoading}
                  className="shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0"
                >
                  {newsletterLoading ? t.common.loading : t.footer.subscribe}
                </Button>
              </form>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>© {year} {restaurantName}. {t.footer.rights}.</span>
            <span className="flex items-center gap-1">
              {t.footer.poweredBy} <Heart className="size-3 text-red-400 fill-red-400" /> {restaurantName}
            </span>
          </div>
        </div>
      </div>

      {/* Mobile Footer - Minimal */}
      <div className="md:hidden">
        <div className="px-4 py-4 flex flex-col items-center gap-3">
          {/* Operating hours (compact) */}
          {openTime && closeTime && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Clock className="size-3 text-amber-600 dark:text-amber-400" />
              <span>{formatHour(openTime)} - {formatHour(closeTime)}</span>
            </div>
          )}

          {/* Social icons */}
          <div className="flex items-center gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="size-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                aria-label={link.label}
              >
                <link.icon className="size-3.5" />
              </a>
            ))}
          </div>

          {/* Newsletter (compact) */}
          <form onSubmit={handleNewsletterSubmit} className="w-full max-w-xs flex gap-1.5">
            <Input
              type="email"
              placeholder={t.footer.emailPlaceholder}
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              type="submit"
              size="sm"
              disabled={newsletterLoading}
              className="shrink-0 h-8 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white border-0 text-xs"
            >
              {newsletterLoading ? t.common.loading : <Send className="size-3" />}
            </Button>
          </form>

          <p className="text-[10px] text-muted-foreground text-center">
            © {year} {restaurantName}. {t.footer.rights}.
          </p>
          <p className="text-[9px] text-muted-foreground/60 flex items-center gap-1">
            {t.footer.poweredBy} <Heart className="size-2.5 text-red-400 fill-red-400" /> {restaurantName}
          </p>
        </div>
      </div>
    </footer>
  );
}
