"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Clock,
  Phone,
  UserPlus,
  LogOut,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Timer,
  Sun,
  Moon,
  Coffee,
  UtensilsCrossed,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";

/* ─── Types ─── */
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
export function WaitlistSection() {
  const { t, isRTL, locale } = useI18n();
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const customerName = useRestaurantStore((s) => s.customerName);
  const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
  const setCustomerName = useRestaurantStore((s) => s.setCustomerName);

  // Current waitlist state
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(true);

  // Join form
  const [name, setName] = useState(customerName || "");
  const [phone, setPhone] = useState(customerPhone || "");
  const [partySize, setPartySize] = useState(2);
  const [isJoining, setIsJoining] = useState(false);
  const [joinedEntry, setJoinedEntry] = useState<WaitlistEntry | null>(null);

  // Lookup
  const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
  const [myEntry, setMyEntry] = useState<WaitlistEntry | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Countdown timer for wait
  const [waitCountdown, setWaitCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated position counter
  const [displayPosition, setDisplayPosition] = useState(0);
  const positionRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Celebration state
  const [celebrating, setCelebrating] = useState(false);

  // Sync from store
  useEffect(() => {
    if (customerName && !name) setName(customerName);
    if (customerPhone && !phone) setPhone(customerPhone);
  }, [customerName, customerPhone]);

  /* ─── Fetch current waitlist ─── */
  const fetchEntries = useCallback(async () => {
    setIsLoadingEntries(true);
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      // silently fail for banner
    } finally {
      setIsLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  /* ─── Computed values ─── */
  const waitingCount = entries.filter((e) => e.status === "waiting").length;
  const avgWait = waitingCount > 0
    ? Math.max(15, waitingCount * 10)
    : 0;

  const waitLevel = avgWait <= 15 ? "short" : avgWait <= 30 ? "moderate" : "long";
  const waitColor = waitLevel === "short"
    ? "bg-emerald-500"
    : waitLevel === "moderate"
    ? "bg-amber-500"
    : "bg-red-500";
  const waitLabel = waitLevel === "short"
    ? t.waitlist.shortWait
    : waitLevel === "moderate"
    ? t.waitlist.moderateWait
    : t.waitlist.longWait;

  /* ─── Join waitlist ─── */
  const handleJoin = async () => {
    if (!name || !phone || !partySize) {
      toast.error(t.common.error, { description: t.common.requiredFields });
      return;
    }

    setIsJoining(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, customerPhone: phone, partySize }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join waitlist");
      }

      const data = await res.json();
      setJoinedEntry(data.entry);
      setMyEntry(data.entry);

      setCustomerName(name);
      setCustomerPhone(phone);

      toast.success(t.waitlist.onTheList, {
        description: t.waitlist.wellNotify,
      });

      fetchEntries();
    } catch (err) {
      toast.error(t.common.error, { description: err instanceof Error ? err.message : t.common.error });
    } finally {
      setIsJoining(false);
    }
  };

  /* ─── Look up position ─── */
  const handleLookup = async () => {
    if (!lookupPhone.trim()) return;
    setIsLookingUp(true);
    try {
      // Fetch all entries and find the matching one
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const allEntries: WaitlistEntry[] = data.entries || [];
      const found = allEntries.find(
        (e: WaitlistEntry) => e.customerPhone === lookupPhone.trim() && e.status === "waiting"
      );
      setMyEntry(found || null);
    } catch {
      toast.error(t.common.error);
      setMyEntry(null);
    } finally {
      setIsLookingUp(false);
    }
  };

  /* ─── Leave waitlist ─── */
  const handleLeave = async (id: string) => {
    try {
      const res = await fetch(`/api/waitlist/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error("Failed to leave");
      toast.success(t.waitlist.leaveWaitlist);
      setMyEntry(null);
      setJoinedEntry(null);
      fetchEntries();
    } catch {
      toast.error(t.common.error);
    }
  };

  /* ─── Calculate position ─── */
  const getPosition = (entry: WaitlistEntry) => {
    const waitingEntries = entries.filter((e) => e.status === "waiting");
    const sorted = [...waitingEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const idx = sorted.findIndex((e) => e.id === entry.id);
    return idx >= 0 ? idx + 1 : sorted.length;
  };

  const partiesAhead = myEntry ? getPosition(myEntry) - 1 : 0;
  const estimatedWaitMin = myEntry ? Math.max(10, partiesAhead * 10) : 0;

  // Animated position counter effect
  useEffect(() => {
    const entry = joinedEntry || myEntry;
    if (!entry) return;
    const targetPos = getPosition(entry);

    // Animate from 0 to target position
    if (positionRef.current) clearInterval(positionRef.current);
    let current = 0;
    positionRef.current = setInterval(() => {
      current++;
      setDisplayPosition(current);
      if (current >= targetPos) {
        if (positionRef.current) clearInterval(positionRef.current);
      }
    }, 80);

    return () => {
      if (positionRef.current) clearInterval(positionRef.current);
    };
  }, [joinedEntry, myEntry, entries]);

  // Countdown timer for estimated wait
  useEffect(() => {
    if (!myEntry && !joinedEntry) return;
    const entry = joinedEntry || myEntry;
    if (!entry) return;
    const pos = getPosition(entry);
    const waitMin = Math.max(10, (pos - 1) * 10);
    setWaitCountdown(waitMin * 60); // in seconds

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setWaitCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [joinedEntry, myEntry, entries]);

  // Celebration when it's your turn
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
            className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-purple-500/15 to-violet-500/15 border border-purple-500/20 mb-3"
          >
            <Users className="size-8 text-purple-600 dark:text-purple-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.waitlist.title}</h1>
          <p className="text-muted-foreground mt-1">{t.waitlist.subtitle}</p>
        </motion.div>

        {/* ─── Current Wait Status Banner ─── */}
        <motion.div variants={fadeIn}>
          <Card className="shadow-sm border-border/50 overflow-hidden">
            <div className={`h-1.5 ${waitColor}`} />
            <CardContent className="pt-4 pb-4">
              {isLoadingEntries ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : waitingCount === 0 ? (
                <div className="text-center py-2">
                  <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">{t.waitlist.noOneWaiting}</p>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{t.waitlist.currentWait}</p>
                    <p className="text-3xl font-bold">
                      {avgWait}
                      <span className="text-sm font-normal text-muted-foreground ms-1">{t.waitlist.minutes}</span>
                    </p>
                  </div>
                  <div className="text-end">
                    <Badge className={`${waitColor} text-white border-0 mb-1`}>{waitLabel}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {waitingCount} {t.waitlist.partiesWaiting}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Your Position (if on list) ─── */}
        <AnimatePresence>
          {(joinedEntry || myEntry) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            >
              <Card className={`border-primary/30 bg-primary/5 ${celebrating ? "animate-celebrate" : ""}`}>
                <CardContent className="pt-5 pb-5 space-y-4">
                  {/* Celebration banner */}
                  {celebrating && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-800"
                    >
                      <span className="text-xl">🎉</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        {locale === "ar" ? "دورك! ادخل الآن!" : t.waitlist.yourTurn}
                      </span>
                    </motion.div>
                  )}

                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="size-5" />
                    <span className="font-semibold">{t.waitlist.onTheList}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="space-y-1">
                      <motion.p
                        key={displayPosition}
                        initial={{ scale: 1.3, y: -5 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        className="text-2xl font-bold text-primary"
                      >
                        #{displayPosition || getPosition(joinedEntry || myEntry!)}
                      </motion.p>
                      <p className="text-xs text-muted-foreground">{t.waitlist.yourPosition}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{partiesAhead}</p>
                      <p className="text-xs text-muted-foreground">{t.waitlist.partiesAhead}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold tabular-nums">
                        {waitCountdown > 0 ? (
                          <span>{countdownMin}:{countdownSec.toString().padStart(2, "0")}</span>
                        ) : (
                          estimatedWaitMin
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{t.waitlist.minutes}</p>
                    </div>
                  </div>

                  {/* Progress bar showing position */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{t.waitlist.yourPosition}</span>
                      <span>{t.waitlist.estimatedWait}: {countdownMin}:{countdownSec.toString().padStart(2, "0")}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-purple-500 rounded-full progress-glow"
                        initial={{ width: "0%" }}
                        animate={{ width: `${waitingCount > 0 ? ((waitingCount - partiesAhead) / waitingCount) * 100 : 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>

                  {/* Alert when position is 1-2 */}
                  {partiesAhead <= 2 && partiesAhead > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                    >
                      <span className="text-xl">🔔</span>
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          {locale === "ar" ? t.waitlist.yourTurnComingAr : t.waitlist.yourTurnComing}
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-500">
                          {locale === "ar"
                            ? t.waitlist.partiesAheadAr.replace("{{count}}", String(partiesAhead))
                            : t.waitlist.partiesAheadEn.replace("{{count}}", String(partiesAhead))
                          }
                        </p>
                      </div>
                    </motion.div>
                  )}

                  <p className="text-xs text-muted-foreground text-center">{t.waitlist.wellNotify}</p>

                  <Button
                    variant="outline"
                    className="w-full text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 border-red-200 dark:border-red-800"
                    onClick={() => handleLeave((joinedEntry || myEntry)!.id)}
                  >
                    <LogOut className="size-4 me-2" />
                    {t.waitlist.leaveWaitlist}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Join Waitlist Form ─── */}
        {!joinedEntry && !myEntry && (
          <motion.div variants={fadeIn}>
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <UserPlus className="size-4 text-primary" />
                  </div>
                  {t.waitlist.joinWaitlist}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="wl-name" className="text-sm font-medium">{t.waitlist.yourName}</Label>
                  <Input
                    id="wl-name"
                    placeholder={t.waitlist.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary h-11"
                  />
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="wl-phone" className="text-sm font-medium">{t.waitlist.yourPhone}</Label>
                  <Input
                    id="wl-phone"
                    placeholder={t.waitlist.phonePlaceholder}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    type="tel"
                    className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary h-11"
                  />
                </div>

                {/* Party Size */}
                <div className="space-y-1.5">
                  <Label>{t.waitlist.partySize}</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }, (_, i) => i + 1).map((size) => (
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

                {/* Submit */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleJoin}
                  disabled={isJoining || !name || !phone}
                >
                  {isJoining ? (
                    <Loader2 className="size-4 animate-spin me-2" />
                  ) : (
                    <UserPlus className="size-4 me-2" />
                  )}
                  {t.waitlist.joinWaitlist}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ─── Find My Spot ─── */}
        {!joinedEntry && !myEntry && (
          <motion.div variants={fadeIn}>
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Search className="size-4 text-primary" />
                  </div>
                  {t.waitlist.findEntry}
                </CardTitle>
                <CardDescription>{t.waitlist.enterPhone}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      placeholder={t.waitlist.phonePlaceholder}
                      value={lookupPhone}
                      onChange={(e) => setLookupPhone(e.target.value)}
                      className="ps-9"
                      type="tel"
                    />
                  </div>
                  <Button
                    onClick={handleLookup}
                    disabled={isLookingUp || !lookupPhone.trim()}
                  >
                    {isLookingUp ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                  </Button>
                </div>

                <AnimatePresence>
                  {!isLookingUp && lookupPhone && myEntry === null && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mt-4 text-center"
                    >
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

        {/* ─── Best Times to Visit ─── */}
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
              {/* Peak hours */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <UtensilsCrossed className="size-3.5" />
                  {t.waitlist.peekHours}
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

              {/* Best times */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Coffee className="size-3.5" />
                  {t.waitlist.bestTimes}
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

        {/* Bottom spacing for mobile nav */}
        <div className="h-4" />
      </motion.div>
    </div>
  );
}
