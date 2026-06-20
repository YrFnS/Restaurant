"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export function Footer() {
  const { t, isRTL, fmtTime } = useI18n();
  const { setActiveSection } = useRestaurantStore();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      return r.json();
    },
  });
  const s = data?.settings;

  return (
    <footer className="mt-auto bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🌶️</span>
              <span className="font-bold text-lg">
                {isRTL ? s?.nameAr || "زعفران وبهارات" : s?.nameEn || "Saffron & Spice"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isRTL ? s?.descriptionAr : s?.descriptionEn}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
              {isRTL ? "روابط سريعة" : "Quick Links"}
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { id: "menu", label: t.nav.menu },
                { id: "reservations", label: t.nav.reservations },
                { id: "orders", label: t.nav.orders },
                { id: "rewards", label: t.nav.rewards },
                { id: "contact", label: t.nav.contact },
              ].map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setActiveSection(l.id as any)}
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
              {t.contact.title}
            </h3>
            <ul className="space-y-2.5 text-sm">
              {s?.phone && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Phone className="size-4 text-primary shrink-0" />
                  <span dir="ltr">{s.phone}</span>
                </li>
              )}
              {s?.email && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <Mail className="size-4 text-primary shrink-0" />
                  <span>{s.email}</span>
                </li>
              )}
              {s?.addressEn && (
                <li className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <span>{isRTL ? s.addressAr : s.addressEn}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
              {t.contact.hours}
            </h3>
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground mb-3">
              <Clock className="size-4 text-primary shrink-0" />
              <span>
                {s?.openTime} - {s?.closeTime}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {s?.facebookUrl && (
                <a href={s.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Facebook className="size-5" />
                </a>
              )}
              {s?.instagramUrl && (
                <a href={s.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Instagram className="size-5" />
                </a>
              )}
              {s?.whatsappUrl && (
                <a href={s.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg className="size-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {isRTL ? s?.nameAr : s?.nameEn}. {isRTL ? "جميع الحقوق محفوظة." : "All rights reserved."}</p>
          <p className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
            {t.home.openNow}
          </p>
        </div>
      </div>
    </footer>
  );
}
