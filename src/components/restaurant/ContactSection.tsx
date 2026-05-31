"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  UtensilsCrossed,
  PartyPopper,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { ContactForm } from "./contact/ContactForm";
import { MapView } from "./contact/MapView";
import { SocialLinks } from "./contact/SocialLinks";

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

const FAQ_ITEMS = [
  { qKey: "faqDelivery", aKey: "faqDeliveryAnswer" },
  { qKey: "faqLargeParty", aKey: "faqLargePartyAnswer" },
  { qKey: "faqCatering", aKey: "faqCateringAnswer" },
  { qKey: "faqHours", aKey: "faqHoursAnswer" },
  { qKey: "faqVegetarian", aKey: "faqVegetarianAnswer" },
] as const;

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export function ContactSection() {
  const { t, locale } = useI18n();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedback, setFeedback] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setSettings(data.settings);
      } catch { /* Settings unavailable — leave as null, UI shows loading state */ }
      finally { }
    }
    load();
  }, []);

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

  const getAddress = () => {
    if (!settings) return "";
    return locale === "ar" ? settings.addressAr : settings.addressEn;
  };

  const getName = () => {
    if (!settings) return t.app.name;
    return locale === "ar" ? settings.nameAr : settings.nameEn;
  };

  const handleSendFeedback = async () => {
    if (!feedback.trim() || !feedbackName.trim() || rating === 0) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: feedbackName, email: feedbackEmail || undefined, rating, comment: feedback }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to submit feedback"); }
      toast.success(t.contact.feedbackSuccess);
      setFeedback(""); setFeedbackName(""); setFeedbackEmail(""); setRating(0);
    } catch (error) {
      toast.error(t.contact.feedbackError, { description: t.contact.feedbackErrorDesc });
    } finally { setIsSending(false); }
  };

  const getDirectionsUrl = () => {
    if (!settings) return "#";
    return `https://www.google.com/maps/dir/?api=1&destination=${settings.latitude},${settings.longitude}`;
  };

  const restaurantIsOpen = isOpen();

  return (
    <div className="min-h-screen bg-background">
      <motion.div className="px-4 py-6 max-w-2xl mx-auto space-y-6" variants={stagger} initial="initial" animate="animate">
        {/* Header */}
        <motion.div variants={fadeIn} className="text-center">
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }} className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/20 mb-3">
            <Phone className="size-8 text-amber-600 dark:text-amber-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.contact.title}</h1>
          <p className="text-muted-foreground mt-1">{t.contact.subtitle}</p>
        </motion.div>

        {/* Restaurant Info / Map */}
        <motion.div variants={fadeIn}>
          <MapView
            restaurantName={getName()} restaurantIsOpen={restaurantIsOpen}
            address={getAddress()} phone={settings?.phone || null} email={settings?.email || null}
            openTime={settings?.openTime || ""} closeTime={settings?.closeTime || ""}
            directionsUrl={getDirectionsUrl()}
          />
        </motion.div>

        {/* Social Media Links */}
        <motion.div variants={fadeIn}>
          <SocialLinks
            facebookUrl={settings?.facebookUrl} instagramUrl={settings?.instagramUrl} twitterUrl={settings?.twitterUrl}
          />
        </motion.div>

        {/* Feedback Form */}
        <motion.div variants={fadeIn}>
          <ContactForm
            feedbackName={feedbackName} feedbackEmail={feedbackEmail} feedback={feedback}
            rating={rating} hoverRating={hoverRating} isSending={isSending}
            onNameChange={setFeedbackName} onEmailChange={setFeedbackEmail} onFeedbackChange={setFeedback}
            onRatingClick={setRating} onRatingHover={setHoverRating} onRatingLeave={() => setHoverRating(0)}
            onSend={handleSendFeedback}
          />
        </motion.div>

        {/* FAQ Section */}
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
                {FAQ_ITEMS.map((item) => (
                  <AccordionItem key={item.qKey} value={item.qKey}>
                    <AccordionTrigger className="text-sm text-start">{t.contact[item.qKey]}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{t.contact[item.aKey]}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>

        {/* Services Cards */}
        <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Button variant="outline" className="w-full" size="sm">{t.contact.learnMore}</Button>
            </CardContent>
          </Card>
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
              <Button variant="outline" className="w-full" size="sm">{t.contact.learnMore}</Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="h-4" />
      </motion.div>
    </div>
  );
}
