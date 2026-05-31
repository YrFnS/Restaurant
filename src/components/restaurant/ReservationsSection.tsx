"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarDays,
  Users,
  MapPin,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";
import { ReservationForm } from "./reservations/ReservationForm";
import { ReservationList } from "./reservations/ReservationList";

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

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export function ReservationsSection() {
  const { t } = useI18n();
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const customerName = useRestaurantStore((s) => s.customerName);
  const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
  const setCustomerName = useRestaurantStore((s) => s.setCustomerName);
  const settings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);

  const [name, setName] = useState(customerName || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [occasion, setOccasion] = useState("");
  const [preference, setPreference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<Reservation | null>(null);
  const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (customerName && !name) setName(customerName);
    if (customerPhone && !phone) setPhone(customerPhone);
  }, [customerName, customerPhone]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const TIME_SLOTS = useMemo(() => generateTimeSlots(settings?.openTime, settings?.closeTime), [settings?.openTime, settings?.closeTime]);

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
          customerName: name, customerPhone: phone, customerEmail: email || undefined,
          partySize, dateTime: dateTime.toISOString(),
          occasion: occasion || undefined, preference: preference || undefined, notes: notes || undefined,
        }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to create reservation"); }
      const data = await res.json();
      setConfirmedReservation(data.reservation);
      setConfirmationOpen(true);
      setCustomerName(name);
      setCustomerPhone(phone);
      setEmail(""); setNotes(""); setOccasion(""); setPreference(""); setTime(""); setDate(undefined); setPartySize(2);
    } catch (err) {
      toast.error(t.common.error, { description: err instanceof Error ? err.message : t.common.error });
    } finally { setIsSubmitting(false); }
  };

  const fetchReservations = useCallback(async (phoneNum: string) => {
    if (!phoneNum.trim()) return;
    setIsLoadingReservations(true); setHasSearched(true);
    try {
      const res = await fetch(`/api/reservations?phone=${encodeURIComponent(phoneNum.trim())}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setReservations(data.reservations || []);
    } catch { toast.error(t.common.error); setReservations([]); }
    finally { setIsLoadingReservations(false); }
  }, [t]);

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
      if (!res.ok) throw new Error("Failed to cancel");
      toast.success(t.reservations.cancelled, { description: t.reservations.cancelReservation });
      if (lookupPhone) fetchReservations(lookupPhone);
    } catch { toast.error(t.common.error); }
  };

  const getOccasionLabel = (occ: string | null) => {
    if (!occ) return "";
    switch (occ) { case "birthday": return t.reservations.birthday; case "anniversary": return t.reservations.anniversary; case "business": return t.reservations.business; case "casual": return t.reservations.casual; default: return occ; }
  };

  const getPreferenceLabel = (pref: string | null) => {
    if (!pref) return "";
    switch (pref) { case "indoor": return t.reservations.indoor; case "outdoor": return t.reservations.outdoor; case "window": return t.reservations.window; case "bar": return t.reservations.bar; default: return pref; }
  };

  return (
    <div className="min-h-screen bg-background">
      <motion.div className="px-4 py-6 max-w-2xl mx-auto space-y-6" variants={stagger} initial="initial" animate="animate">
        <motion.div variants={fadeIn} className="text-center">
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }} className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-teal-500/15 to-emerald-500/15 border border-teal-500/20 mb-3">
            <CalendarDays className="size-8 text-teal-600 dark:text-teal-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.reservations.title}</h1>
          <p className="text-muted-foreground mt-1">{t.reservations.subtitle}</p>
        </motion.div>

        <motion.div variants={fadeIn}>
          <ReservationForm
            name={name} phone={phone} email={email} partySize={partySize}
            date={date} time={time} occasion={occasion} preference={preference} notes={notes}
            timeSlots={TIME_SLOTS} isSubmitting={isSubmitting}
            onNameChange={setName} onPhoneChange={setPhone} onEmailChange={setEmail} onPartySizeChange={setPartySize}
            onDateChange={setDate} onTimeChange={setTime} onOccasionChange={setOccasion}
            onPreferenceChange={setPreference} onNotesChange={setNotes} onSubmit={handleSubmit}
          />
        </motion.div>

        <Dialog open={confirmationOpen} onOpenChange={setConfirmationOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex flex-col items-center gap-3 pt-4">
                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <svg className="size-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </motion.div>
                <motion.span className="absolute top-10 start-8 text-lg" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.8, delay: 0.3 }}>✨</motion.span>
                <motion.span className="absolute top-12 end-10 text-sm" initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.7, delay: 0.5 }}>🎉</motion.span>
                <DialogTitle className="text-xl text-center">{t.reservations.reservationConfirmed}</DialogTitle>
                <DialogDescription className="text-center">{t.reservations.confirmationSent}</DialogDescription>
              </div>
            </DialogHeader>
            {confirmedReservation && (
              <div className="space-y-3 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="size-4 shrink-0" /><span>{confirmedReservation.dateTime ? format(new Date(confirmedReservation.dateTime), "PPP") : ""}</span></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg><span>{confirmedReservation.dateTime ? format(new Date(confirmedReservation.dateTime), "HH:mm") : ""}</span></div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Users className="size-4 shrink-0" /><span>{confirmedReservation.partySize} {t.reservations.guests}</span></div>
                  {confirmedReservation.table && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4 shrink-0" /><span>{t.reservations.tableInfo} #{confirmedReservation.table.number}</span></div>}
                </div>
                {confirmedReservation.occasion && (<Badge variant="outline" className="text-xs">{getOccasionLabel(confirmedReservation.occasion)}</Badge>)}
                {confirmedReservation.preference && (<Badge variant="outline" className="text-xs ms-2">{getPreferenceLabel(confirmedReservation.preference)}</Badge>)}
              </div>
            )}
            <Button onClick={() => setConfirmationOpen(false)} className="w-full">{t.common.close}</Button>
          </DialogContent>
        </Dialog>

        <motion.div variants={fadeIn}>
          <ReservationList
            lookupPhone={lookupPhone} reservations={reservations}
            isLoadingReservations={isLoadingReservations} hasSearched={hasSearched}
            onLookupPhoneChange={setLookupPhone} onSearch={() => fetchReservations(lookupPhone)} onCancel={handleCancel}
          />
        </motion.div>

        <div className="h-4" />
      </motion.div>
    </div>
  );
}
