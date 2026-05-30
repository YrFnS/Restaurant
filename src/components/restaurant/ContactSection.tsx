"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Star,
  Send,
  Facebook,
  Instagram,
  Twitter,
  ChevronDown,
  UtensilsCrossed,
  PartyPopper,
  Navigation,
  ExternalLink,
  Loader2,
  CheckCircle2,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

/* ─── Types ─── */
interface RestaurantSettings {
  nameEn: string;
  nameAr: string;
  phone: string;
  email: string;
  addressEn: string;
  addressAr: string;
  latitude: number;
  longitude: number;
  openTime: string;
  closeTime: string;
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
}

/* ─── FAQ data ─── */
const FAQ_ITEMS = [
  { qKey: "faqDelivery", aKey: "faqDeliveryAnswer" },
  { qKey: "faqLargeParty", aKey: "faqLargePartyAnswer" },
  { qKey: "faqCatering", aKey: "faqCateringAnswer" },
  { qKey: "faqHours", aKey: "faqHoursAnswer" },
  { qKey: "faqVegetarian", aKey: "faqVegetarianAnswer" },
] as const;

/* ─── Hours data ─── */
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/* ─── Animation variants ─── */
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

/* ─── Component ─── */
export function ContactSection() {
  const { t, locale, isRTL } = useI18n();

  // Settings
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Feedback
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Load settings
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setSettings(data.settings);
      } catch {
        // Settings unavailable — leave as null, UI shows loading state
      } finally {
        setIsLoadingSettings(false);
      }
    }
    load();
  }, []);

  /* ─── Is restaurant currently open? ─── */
  const isOpen = () => {
    if (!settings) return false;
    const now = new Date();
    const [openH, openM] = settings.openTime.split(":").map(Number);
    const [closeH, closeM] = settings.closeTime.split(":").map(Number);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    return nowMin >= openMin && nowMin < closeMin;
  };

  /* ─── Get address ─── */
  const getAddress = () => {
    if (!settings) return "";
    return locale === "ar" ? settings.addressAr : settings.addressEn;
  };

  /* ─── Get name ─── */
  const getName = () => {
    if (!settings) return t.app.name;
    return locale === "ar" ? settings.nameAr : settings.nameEn;
  };

  /* ─── Format hours ─── */
  const formatHour = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  /* ─── Send feedback (persisted to database) ─── */
  const handleSendFeedback = async () => {
    if (!feedback.trim() || !feedbackName.trim() || rating === 0) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: feedbackName,
          email: feedbackEmail || undefined,
          rating,
          comment: feedback,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit feedback");
      }

      toast.success(t.contact.feedbackSuccess);
      setFeedback("");
      setFeedbackName("");
      setFeedbackEmail("");
      setRating(0);
    } catch (error) {
      toast.error(t.contact.feedbackError, {
        description: t.contact.feedbackErrorDesc,
      });
    } finally {
      setIsSending(false);
    }
  };

  /* ─── Google Maps link ─── */
  const getDirectionsUrl = () => {
    if (!settings) return "#";
    return `https://www.google.com/maps/dir/?api=1&destination=${settings.latitude},${settings.longitude}`;
  };

  const restaurantIsOpen = isOpen();

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        className="px-4 py-6 max-w-2xl mx-auto space-y-6"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {/* ─── Header ─── */}
        <motion.div variants={fadeIn} className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/20 mb-3"
          >
            <Phone className="size-8 text-amber-600 dark:text-amber-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.contact.title}</h1>
          <p className="text-muted-foreground mt-1">{t.contact.subtitle}</p>
        </motion.div>

        {/* ─── Restaurant Info Card ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardContent className="pt-6 space-y-4">
              {/* Name & Open/Closed Status */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{getName()}</h2>
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
                  <p className="text-sm font-medium">{getAddress()}</p>
                </div>
              </div>

              {/* Phone */}
              {settings && (
                <div className="flex items-center gap-3">
                  <Phone className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.contact.phone}</p>
                    <p className="text-sm font-medium">{settings.phone}</p>
                  </div>
                </div>
              )}

              {/* Email */}
              {settings && (
                <div className="flex items-center gap-3">
                  <Mail className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">{t.contact.email}</p>
                    <p className="text-sm font-medium">{settings.email}</p>
                  </div>
                </div>
              )}

              {/* Get Directions */}
              <Button variant="outline" className="w-full" asChild>
                <a href={getDirectionsUrl()} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-4 me-2" />
                  {t.contact.getDirections}
                  <ExternalLink className="size-3 ms-auto opacity-50" />
                </a>
              </Button>

              <Separator />

              {/* Opening Hours */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
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
                          {settings
                            ? `${formatHour(settings.openTime)} - ${formatHour(settings.closeTime)}`
                            : "—"
                          }
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Social Media Links ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardContent className="pt-6">
              <p className="text-sm font-medium mb-3">{t.contact.followUs}</p>
              <div className="flex items-center gap-2">
                {settings?.facebookUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={settings.facebookUrl} target="_blank" rel="noopener noreferrer">
                      <Facebook className="size-4 me-1.5" />
                      Facebook
                    </a>
                  </Button>
                )}
                {settings?.instagramUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={settings.instagramUrl} target="_blank" rel="noopener noreferrer">
                      <Instagram className="size-4 me-1.5" />
                      Instagram
                    </a>
                  </Button>
                )}
                {settings?.twitterUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={settings.twitterUrl} target="_blank" rel="noopener noreferrer">
                      <Twitter className="size-4 me-1.5" />
                      Twitter
                    </a>
                  </Button>
                )}
                {(!settings || (!settings.facebookUrl && !settings.instagramUrl && !settings.twitterUrl)) && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                      <Facebook className="size-4 me-1.5" />
                      Facebook
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <Instagram className="size-4 me-1.5" />
                      Instagram
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <Twitter className="size-4 me-1.5" />
                      Twitter
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Feedback Form ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="size-4 text-primary" />
                </div>
                {t.contact.feedback}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t.contact.feedbackName}</p>
                <Input
                  placeholder={t.contact.feedbackNamePlaceholder}
                  value={feedbackName}
                  onChange={(e) => setFeedbackName(e.target.value)}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t.contact.feedbackEmail}</p>
                <Input
                  type="email"
                  placeholder={t.contact.feedbackEmailPlaceholder}
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                />
              </div>

              {/* Star Rating */}
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{t.contact.rating}</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110"
                      aria-label={`${star} star${star > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`size-7 ${
                          star <= (hoverRating || rating)
                            ? "text-amber-400 fill-amber-400"
                            : "text-muted-foreground/30"
                        } transition-colors`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="text-sm text-muted-foreground ms-2">
                      {rating}/5
                    </span>
                  )}
                </div>
              </div>

              {/* Feedback Text */}
              <Textarea
                placeholder={t.contact.feedbackPlaceholder}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />

              {/* Send */}
              <Button
                className="w-full"
                onClick={handleSendFeedback}
                disabled={isSending || !feedback.trim() || !feedbackName.trim() || rating === 0}
              >
                {isSending ? (
                  <Loader2 className="size-4 animate-spin me-2" />
                ) : (
                  <Send className="size-4 me-2" />
                )}
                {t.contact.send}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── FAQ Section ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <HelpCircle className="size-4 text-primary" />
                </div>
                {t.contact.faq}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {FAQ_ITEMS.map((item, idx) => (
                  <AccordionItem key={item.qKey} value={item.qKey}>
                    <AccordionTrigger className="text-sm text-start">
                      {t.contact[item.qKey]}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">
                      {t.contact[item.aKey]}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Services Cards ─── */}
        <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Catering */}
          <Card className="overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-amber-500 to-orange-400" />
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-amber-100 dark:bg-amber-900/30 mx-auto">
                <UtensilsCrossed className="size-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold">{t.contact.catering}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.contact.cateringDesc}</p>
              </div>
              <Button variant="outline" className="w-full" size="sm">
                {t.contact.learnMore}
              </Button>
            </CardContent>
          </Card>

          {/* Private Events */}
          <Card className="overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-400" />
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-center size-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mx-auto">
                <PartyPopper className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-center">
                <h3 className="font-semibold">{t.contact.privateEvents}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.contact.privateEventsDesc}</p>
              </div>
              <Button variant="outline" className="w-full" size="sm">
                {t.contact.learnMore}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-4" />
      </motion.div>
    </div>
  );
}
