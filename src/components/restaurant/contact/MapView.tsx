"use client";

import React from "react";
import { MapPin, Navigation, ExternalLink, Phone, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

interface MapViewProps {
  restaurantName: string;
  restaurantIsOpen: boolean;
  address: string;
  phone: string | null;
  email: string | null;
  openTime: string;
  closeTime: string;
  directionsUrl: string;
}

export function MapView({
  restaurantName, restaurantIsOpen, address, phone, email,
  openTime, closeTime, directionsUrl,
}: MapViewProps) {
  const { t, locale } = useI18n();

  const formatHour = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <Card className="shadow-sm border-border/50">
      <CardContent className="pt-6 space-y-4">
        {/* Name & Open/Closed Status */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{restaurantName}</h2>
          <Badge
            className={restaurantIsOpen
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
              : "bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300 border-0"
            }
          >
            {restaurantIsOpen ? t.contact.openNow : t.contact.closedNow}
          </Badge>
        </div>

        {/* Map Placeholder */}
        <div className="relative rounded-lg overflow-hidden bg-muted/50 border h-40 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="size-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t.contact.mapPlaceholder}</p>
          </div>
          {/* Decorative dots */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
        </div>

        {/* Address */}
        <div className="flex items-start gap-3">
          <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t.contact.address}</p>
            <p className="text-sm font-medium">{address}</p>
          </div>
        </div>

        {/* Phone */}
        {phone && (
          <div className="flex items-center gap-3">
            <Phone className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t.contact.phone}</p>
              <p className="text-sm font-medium">{phone}</p>
            </div>
          </div>
        )}

        {/* Email */}
        {email && (
          <div className="flex items-center gap-3">
            <Mail className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t.contact.email}</p>
              <p className="text-sm font-medium">{email}</p>
            </div>
          </div>
        )}

        {/* Get Directions */}
        <Button variant="outline" className="w-full" asChild>
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
            <Navigation className="size-4 me-2" />
            {t.contact.getDirections}
            <ExternalLink className="size-3 ms-auto opacity-50" />
          </a>
        </Button>

        <Separator />

        {/* Opening Hours */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <p className="text-sm font-medium">{t.contact.hours}</p>
          </div>
          <div className="space-y-1">
            {WEEKDAYS.map((day, idx) => {
              const isToday = new Date().getDay() === idx;
              return (
                <div
                  key={day}
                  className={`flex items-center justify-between text-sm py-1 px-2 rounded ${
                    isToday ? "bg-primary/10 font-medium" : ""
                  }`}
                >
                  <span className={isToday ? "text-primary" : "text-muted-foreground"}>
                    {t.contact[day]}
                  </span>
                  <span className={isToday ? "text-primary" : ""}>
                    {openTime && closeTime ? `${formatHour(openTime)} - ${formatHour(closeTime)}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
