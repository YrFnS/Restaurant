"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Phone,
  Search,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Coffee,
  UtensilsCrossed,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";
import { WaitlistForm } from "./waitlist/WaitlistForm";
import { WaitlistEntryCard } from "./waitlist/WaitlistEntry";

interface WaitlistEntry {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show";
  estimatedWait: number;
  notes: string | null;
  createdAt: string;
}

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export function WaitlistSection() {
  const { t, isRTL, locale } = useI18n();
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const customerName = useRestaurantStore((s) => s.customerName);
  const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
  const setCustomerName = useRestaurantStore((s) => s.setCustomerName);

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);
  const [name, setName] = useState(customerName || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [partySize, setPartySize] = useState(2);
  const [isJoining, setIsJoining] = useState(false);
  const [joinedEntry, setJoinedEntry] = useState<WaitlistEntry | null>(null);
  const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
  const [myEntry, setMyEntry] = useState<WaitlistEntry | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [waitCountdown, setWaitCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayPosition, setDisplayPosition] = useState(0);
  const positionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (customerName && !name) setName(customerName);
    if (customerPhone && !phone) setPhone(customerPhone);
  }, [customerName, customerPhone]);

  const fetchEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch { /* silently fail for banner */ }
    finally { setIsLoadingEntries(false); }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const waitingCount = entries.filter((e) => e.status === "waiting").length;
  const avgWait = waitingCount > 0 ? Math.max(15, waitingCount * 10) : 0;
  const waitLevel = avgWait <= 15 ? "short" : avgWait <= 30 ? "moderate" : "long";
  const waitColor = waitLevel === "short" ? "bg-emerald-500" : waitLevel === "moderate" ? "bg-amber-500" : "bg-red-500";
  const waitLabel = waitLevel === "short" ? t.waitlist.shortWait : waitLevel === "moderate" ? t.waitlist.moderateWait : t.waitlist.longWait;

  const handleJoin = async () => {
    if (!name || !phone || !partySize) {
      toast.error(t.common.error, { description: t.common.requiredFields });
      return;
    }
    setIsJoining(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, customerPhone: phone, partySize }),
      });
      if (!res.ok) { const data = await res.json(); throw new Error(data.error || "Failed to join waitlist"); }
      const data = await res.json();
      setJoinedEntry(data.entry);
      setMyEntry(data.entry);
      setCustomerName(name);
      setCustomerPhone(phone);
      toast.success(t.waitlist.onTheList, { description: t.waitlist.wellNotify });
      fetchEntries();
    } catch (err) {
      toast.error(t.common.error, { description: err instanceof Error ? err.message : t.common.error });
    } finally { setIsJoining(false); }
  };

  const handleLookup = async () => {
    if (!lookupPhone.trim()) return;
    setIsLookingUp(true);
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const allEntries: WaitlistEntry[] = data.entries || [];
      const found = allEntries.find((e: WaitlistEntry) => e.customerPhone === lookupPhone.trim() && e.status === "waiting");
      setMyEntry(found || null);
    } catch { toast.error(t.common.error); setMyEntry(null); }
    finally { setIsLookingUp(false); }
  };

  const handleLeave = async (id: string) => {
    try {
      const res = await fetch(`/api/waitlist/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
      if (!res.ok) throw new Error("Failed to leave");
      toast.success(t.waitlist.leaveWaitlist);
      setMyEntry(null); setJoinedEntry(null);
      fetchEntries();
    } catch { toast.error(t.common.error); }
  };

  const getPosition = (entry: WaitlistEntry) => {
    const waitingEntries = entries.filter((e) => e.status === "waiting");
    const sorted = [...waitingEntries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const idx = sorted.findIndex((e) => e.id === entry.id);
    return idx >= 0 ? idx + 1 : sorted.length;
  };

  const partiesAhead = myEntry ? getPosition(myEntry) - 1 : 0;
  const estimatedWaitMin = myEntry ? Math.max(10, partiesAhead * 10) : 0;

  useEffect(() => {
    const entry = joinedEntry || myEntry;
    if (!entry) return;
    const targetPos = getPosition(entry);
    if (positionRef.current) clearInterval(positionRef.current);
    let current = 0;
    positionRef.current = setInterval(() => {
      current++;
      setDisplayPosition(current);
      if (current >= targetPos) { if (positionRef.current) clearInterval(positionRef.current); }
    }, 80);
    return () => { if (positionRef.current) clearInterval(positionRef.current); };
  }, [joinedEntry, myEntry, entries]);

  useEffect(() => {
    if (!myEntry && !joinedEntry) return;
    const entry = joinedEntry || myEntry;
    if (!entry) return;
    const pos = getPosition(entry);
    const waitMin = Math.max(10, (pos - 1) * 10);
    setWaitCountdown(waitMin * 60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => { setWaitCountdown((prev) => Math.max(0, prev - 1)); }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [joinedEntry, myEntry, entries]);

  useEffect(() => {
    if (partiesAhead === 0 && (joinedEntry || myEntry)) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [partiesAhead, joinedEntry, myEntry]);

  const countdownMin = Math.floor(waitCountdown / 60);
  const countdownSec = waitCountdown % 60;

  return (
    <div className="min-h-screen bg-background">
      <motion.div className="px-4 py-6 max-w-2xl mx-auto space-y-6" variants={stagger} initial="initial" animate="animate">
        <motion.div variants={fadeIn} className="text-center">
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }} className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-violet-500/15 border border-purple-500/20 mb-3">
            <Users className="size-8 text-purple-600 dark:text-purple-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.waitlist.title}</h1>
          <p className="text-muted-foreground mt-1">{t.waitlist.subtitle}</p>
        </motion.div>

        {/* Current Wait Status Banner */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50 overflow-hidden">
            <div className={`h-1.5 ${waitColor}`} />
            <CardContent className="pt-4 pb-4">
              {isLoadingEntries ? (
                <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
              ) : waitingCount === 0 ? (
                <div className="text-center py-2">
                  <svg className="size-8 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t.waitlist.noOneWaiting}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.waitlist.currentWait}</p>
                    <p className="text-3xl font-bold">{avgWait}<span className="text-sm font-normal text-muted-foreground ms-1">{t.waitlist.minutes}</span></p>
                  </div>
                  <div className="text-end">
                    <Badge className={`${waitColor} text-white border-0 mb-1`}>{waitLabel}</Badge>
                    <p className="text-sm text-muted-foreground">{waitingCount} {t.waitlist.partiesWaiting}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Your Position (if on list) */}
        <AnimatePresence>
          {(joinedEntry || myEntry) && (
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -10 }} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
              <WaitlistEntryCard
                entry={joinedEntry || myEntry!}
                displayPosition={displayPosition || getPosition(joinedEntry || myEntry!)}
                partiesAhead={partiesAhead} countdownMin={countdownMin} countdownSec={countdownSec}
                waitCountdown={waitCountdown} estimatedWaitMin={estimatedWaitMin}
                waitingCount={waitingCount} celebrating={celebrating}
                onLeave={handleLeave}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Join Waitlist Form */}
        {!joinedEntry && !myEntry && (
          <motion.div variants={fadeIn}>
            <WaitlistForm
              name={name} phone={phone} partySize={partySize} isJoining={isJoining}
              onNameChange={setName} onPhoneChange={setPhone}
              onPartySizeChange={setPartySize} onSubmit={handleJoin}
            />
          </motion.div>
        )}

        {/* Find My Spot */}
        {!joinedEntry && !myEntry && (
          <motion.div variants={fadeIn}>
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <svg className="size-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  {t.waitlist.findEntry}
                </CardTitle>
                <CardDescription>{t.waitlist.enterPhone}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input placeholder={t.waitlist.phonePlaceholder} value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} className="ps-9" type="tel" />
                  </div>
                  <Button onClick={handleLookup} disabled={isLookingUp || !lookupPhone.trim()}>
                    {isLookingUp ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  </Button>
                </div>
                <AnimatePresence>
                  {!isLookingUp && lookupPhone && myEntry === null && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 text-center">
                      <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                        <AlertCircle className="size-7 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t.waitlist.notOnList}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Best Times to Visit */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Timer className="size-4 text-primary" />
                </div>
                {t.waitlist.bestTimes}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <UtensilsCrossed className="size-3.5" />{t.waitlist.peekHours}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
                    <Sun className="size-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-700 dark:text-red-300">{t.waitlist.peakLunch}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
                    <Moon className="size-4 text-red-500 shrink-0" />
                    <span className="text-xs text-red-700 dark:text-red-300">{t.waitlist.peakDinner}</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Coffee className="size-3.5" />{t.waitlist.bestTimes}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <Coffee className="size-4 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">{t.waitlist.bestAfternoon}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                    <Moon className="size-4 text-emerald-500 shrink-0" />
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">{t.waitlist.bestLate}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="h-4" />
      </motion.div>
    </div>
  );
}
