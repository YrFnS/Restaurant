"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  Phone,
  Search,
  X,
  MapPin,
  UtensilsCrossed,
  PartyPopper,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";

/* ─── Types ─── */
interface Reservation {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  partySize: number;
  dateTime: string;
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  occasion: string | null;
  preference: string | null;
  notes: string | null;
  tableId: string | null;
  table: { id: string; number: number; section: string } | null;
  createdAt: string;
}

/* ─── Time slots ─── */
function generateTimeSlots(openTime?: string, closeTime?: string): string[] {
  const slots: string[] = [];
  const startHour = openTime ? parseInt(openTime.split(":")[0]) : 11;
  const endHour = closeTime ? parseInt(closeTime.split(":")[0]) : 22;
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < endHour) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

/* ─── Status badge color ─── */
function getStatusColor(status: string) {
  switch (status) {
    case "confirmed": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "seated": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "completed": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
    case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800";
    case "no_show": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  }
}

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
export function ReservationsSection() {
  const { t, isRTL } = useI18n();
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const customerName = useRestaurantStore((s) => s.customerName);
  const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
  const setCustomerName = useRestaurantStore((s) => s.setCustomerName);
  const settings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);

  // Form state
  const [name, setName] = useState(customerName || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [occasion, setOccasion] = useState("");
  const [preference, setPreference] = useState("");
  const [notes, setNotes] = useState("");

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);

  // My Reservations
  const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Sync from store
  useEffect(() => {
    if (customerName && !name) setName(customerName);
    if (customerPhone && !phone) setPhone(customerPhone);
  }, [customerName, customerPhone]);

  // Fetch settings for time slots
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const TIME_SLOTS = useMemo(() => generateTimeSlots(settings?.openTime, settings?.closeTime), [settings?.openTime, settings?.closeTime]);

  /* ─── Submit reservation ─── */
  const handleSubmit = async () => {
    if (!name || !phone || !partySize || !date || !time) {
      toast.error(t.common.error, { description: t.common.requiredFields });
      return;
    }

    setIsSubmitting(true);
    try {
      const dateTime = new Date(date);
      const [hours, minutes] = time.split(":").map(Number);
      dateTime.setHours(hours, minutes, 0, 0);

      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          partySize,
          dateTime: dateTime.toISOString(),
          occasion: occasion || undefined,
          preference: preference || undefined,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reservation");
      }

      const data = await res.json();
      setConfirmedReservation(data.reservation);
      setConfirmationOpen(true);

      // Save to store
      setCustomerName(name);
      setCustomerPhone(phone);

      // Reset form
      setEmail("");
      setNotes("");
      setOccasion("");
      setPreference("");
      setTime("");
      setDate(undefined);
      setPartySize(2);
    } catch (err) {
      toast.error(t.common.error, { description: err instanceof Error ? err.message : t.common.error });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Fetch reservations ─── */
  const fetchReservations = useCallback(async (phoneNum: string) => {
    if (!phoneNum.trim()) return;
    setIsLoadingReservations(true);
    setHasSearched(true);
    try {
      const res = await fetch(`/api/reservations?phone=${encodeURIComponent(phoneNum.trim())}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch {
      toast.error(t.common.error);
      setReservations([]);
    } finally {
      setIsLoadingReservations(false);
    }
  }, [t]);

  /* ─── Cancel reservation ─── */
  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to cancel");
      toast.success(t.reservations.cancelled, { description: t.reservations.cancelReservation });
      if (lookupPhone) fetchReservations(lookupPhone);
    } catch {
      toast.error(t.common.error);
    }
  };

  /* ─── Get status label ─── */
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return t.reservations.confirmed;
      case "seated": return t.reservations.seated;
      case "completed": return t.reservations.completed;
      case "cancelled": return t.reservations.cancelled;
      case "no_show": return t.reservations.noShow;
      default: return status;
    }
  };

  /* ─── Get occasion label ─── */
  const getOccasionLabel = (occ: string | null) => {
    if (!occ) return "";
    switch (occ) {
      case "birthday": return t.reservations.birthday;
      case "anniversary": return t.reservations.anniversary;
      case "business": return t.reservations.business;
      case "casual": return t.reservations.casual;
      default: return occ;
    }
  };

  /* ─── Get preference label ─── */
  const getPreferenceLabel = (pref: string | null) => {
    if (!pref) return "";
    switch (pref) {
      case "indoor": return t.reservations.indoor;
      case "outdoor": return t.reservations.outdoor;
      case "window": return t.reservations.window;
      case "bar": return t.reservations.bar;
      default: return pref;
    }
  };

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
            className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 border border-teal-500/20 mb-3"
          >
            <CalendarDays className="size-8 text-teal-600 dark:text-teal-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.reservations.title}</h1>
          <p className="text-muted-foreground mt-1">{t.reservations.subtitle}</p>
        </motion.div>

        {/* ─── Reservation Form ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UtensilsCrossed className="size-4 text-primary" />
                </div>
                {t.reservations.newReservation}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="res-name" className="text-sm font-medium">{t.reservations.name}</Label>
                <Input
                  id="res-name"
                  placeholder={t.reservations.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary h-11"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="res-phone" className="text-sm font-medium">{t.reservations.phone}</Label>
                <Input
                  id="res-phone"
                  placeholder={t.reservations.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary h-11"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="res-email" className="text-sm font-medium">{t.reservations.email}</Label>
                <Input
                  id="res-email"
                  placeholder={t.reservations.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary h-11"
                />
              </div>

              {/* Party Size */}
              <div className="space-y-1.5">
                <Label>{t.reservations.partySize}</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={partySize === size ? "default" : "outline"}
                      size="sm"
                      className="min-w-[40px]"
                      onClick={() => setPartySize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Date Picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.reservations.date}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-start font-normal"
                    >
                      <CalendarDays className="size-4 me-2 shrink-0" />
                      {date ? format(date, "PPP") : <span className="text-muted-foreground">{t.reservations.selectDate}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Picker - Visual time slot cards */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.reservations.time}</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = time === slot;
                    const isPast = date && new Date().toDateString() === date.toDateString() && parseInt(slot.split(":")[0]) <= new Date().getHours();
                    return (
                      <motion.button
                        key={slot}
                        whileTap={{ scale: 0.95 }}
                        whileHover={{ scale: 1.05 }}
                        onClick={() => !isPast && setTime(slot)}
                        disabled={isPast}
                        className={`p-2 rounded-lg text-xs font-medium text-center transition-all border ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : isPast
                            ? "bg-muted/30 text-muted-foreground/40 border-transparent cursor-not-allowed line-through"
                            : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:border-primary hover:shadow-sm"
                        }`}
                      >
                        {slot}
                        {!isSelected && !isPast && (
                          <span className="block text-[8px] text-emerald-500 dark:text-emerald-500 mt-0.5">{t.reservations.available}</span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger>
                    <Clock className="size-4 me-2 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder={t.reservations.selectTime} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Occasion */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.reservations.occasion}</Label>
                <Select value={occasion} onValueChange={setOccasion}>
                  <SelectTrigger>
                    <PartyPopper className="size-4 me-2 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder={t.reservations.occasionPlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="birthday">{t.reservations.birthday}</SelectItem>
                    <SelectItem value="anniversary">{t.reservations.anniversary}</SelectItem>
                    <SelectItem value="business">{t.reservations.business}</SelectItem>
                    <SelectItem value="casual">{t.reservations.casual}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seating Preference */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t.reservations.preference}</Label>
                <RadioGroup value={preference} onValueChange={setPreference} className="grid grid-cols-2 gap-2">
                  {[
                    { value: "indoor", label: t.reservations.indoor },
                    { value: "outdoor", label: t.reservations.outdoor },
                    { value: "window", label: t.reservations.window },
                    { value: "bar", label: t.reservations.bar },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`pref-${opt.value}`} />
                      <Label htmlFor={`pref-${opt.value}`} className="cursor-pointer text-sm font-normal">
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Special Requests */}
              <div className="space-y-2">
                <Label htmlFor="res-notes" className="text-sm font-medium">{t.reservations.notes}</Label>
                <Textarea
                  id="res-notes"
                  placeholder={t.reservations.notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary resize-none"
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={isSubmitting || !name || !phone || !date || !time}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin me-2" />
                ) : (
                  <CheckCircle2 className="size-4 me-2" />
                )}
                {t.reservations.confirmReservation}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Confirmation Dialog ─── */}
        <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex flex-col items-center gap-3 pt-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"
                >
                  <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
                </motion.div>
                {/* Confirmation sparkle effects */}
                <motion.span
                  className="absolute top-10 start-8 text-lg"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >✨</motion.span>
                <motion.span
                  className="absolute top-12 end-10 text-sm"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0] }}
                  transition={{ duration: 0.7, delay: 0.5 }}
                >🎉</motion.span>
                <DialogTitle className="text-xl text-center">
                  {t.reservations.reservationConfirmed}
                </DialogTitle>
                <DialogDescription className="text-center">
                  {t.reservations.confirmationSent}
                </DialogDescription>
              </div>
            </DialogHeader>
            {confirmedReservation && (
              <div className="space-y-3 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="size-4 shrink-0" />
                    <span>{confirmedReservation.dateTime ? format(new Date(confirmedReservation.dateTime), "PPP") : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4 shrink-0" />
                    <span>{confirmedReservation.dateTime ? format(new Date(confirmedReservation.dateTime), "HH:mm") : ""}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-4 shrink-0" />
                    <span>{confirmedReservation.partySize} {t.reservations.guests}</span>
                  </div>
                  {confirmedReservation.table && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-4 shrink-0" />
                      <span>{t.reservations.tableInfo} #{confirmedReservation.table.number}</span>
                    </div>
                  )}
                </div>
                {confirmedReservation.occasion && (
                  <Badge variant="outline" className="text-xs">
                    {getOccasionLabel(confirmedReservation.occasion)}
                  </Badge>
                )}
                {confirmedReservation.preference && (
                  <Badge variant="outline" className="text-xs ms-2">
                    {getPreferenceLabel(confirmedReservation.preference)}
                  </Badge>
                )}
              </div>
            )}
            <Button onClick={() => setConfirmationOpen(false)} className="w-full">
              {t.common.close}
            </Button>
          </DialogContent>
        </Dialog>

        {/* ─── My Reservations ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="size-4 text-primary" />
                </div>
                {t.reservations.yourReservations}
              </CardTitle>
              <CardDescription>{t.reservations.enterPhone}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Lookup */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder={t.reservations.phonePlaceholder}
                    value={lookupPhone}
                    onChange={(e) => setLookupPhone(e.target.value)}
                    className="ps-9"
                    type="tel"
                  />
                </div>
                <Button
                  onClick={() => fetchReservations(lookupPhone)}
                  disabled={isLoadingReservations || !lookupPhone.trim()}
                  variant="default"
                >
                  {isLoadingReservations ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    t.reservations.lookup
                  )}
                </Button>
              </div>

              {/* Results */}
              <AnimatePresence mode="wait">
                {isLoadingReservations ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-8">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </motion.div>
                ) : hasSearched && reservations.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                    <div className="size-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <CalendarDays className="size-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-muted-foreground mb-1">{t.reservations.noReservations}</p>
                    <p className="text-xs text-muted-foreground/70">{t.reservations.enterPhone}</p>
                  </motion.div>
                ) : (
                  <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 max-h-96 overflow-y-auto">
                    {reservations.map((res) => (
                      <motion.div
                        key={res.id}
                        initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <CalendarDays className="size-3.5 text-muted-foreground" />
                              {format(new Date(res.dateTime), "MMM d, yyyy")}
                              <Clock className="size-3.5 text-muted-foreground ms-1" />
                              {format(new Date(res.dateTime), "HH:mm")}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Users className="size-3" />
                              {res.partySize} {t.reservations.guests}
                              {res.occasion && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {getOccasionLabel(res.occasion)}
                                </Badge>
                              )}
                              {res.preference && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {getPreferenceLabel(res.preference)}
                                </Badge>
                              )}
                            </div>
                            {res.table && (
                              <div className="text-xs text-muted-foreground">
                                {t.reservations.tableInfo} #{res.table.number}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge className={`text-[10px] ${getStatusColor(res.status)}`}>
                              {getStatusLabel(res.status)}
                            </Badge>
                            {res.status === "confirmed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 h-7 text-xs px-2"
                                onClick={() => handleCancel(res.id)}
                              >
                                <X className="size-3 me-1" />
                                {t.reservations.cancelReservation}
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom spacing for mobile nav */}
        <div className="h-4" />
      </motion.div>
    </div>
  );
}
