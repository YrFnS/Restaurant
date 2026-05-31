"use client";

import React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface WaitlistEntryEntry {
  id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: "waiting" | "notified" | "seated" | "cancelled" | "no_show";
  estimatedWait: number;
  notes: string | null;
  createdAt: string;
}

interface WaitlistEntryProps {
  entry: WaitlistEntryEntry;
  displayPosition: number;
  partiesAhead: number;
  countdownMin: number;
  countdownSec: number;
  waitCountdown: number;
  estimatedWaitMin: number;
  waitingCount: number;
  celebrating: boolean;
  onLeave: (id: string) => void;
}

export function WaitlistEntryCard({
  entry, displayPosition, partiesAhead, countdownMin, countdownSec,
  waitCountdown, estimatedWaitMin, waitingCount, celebrating, onLeave,
}: WaitlistEntryProps) {
  const { t, locale } = useI18n();

  return (
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
              #{displayPosition || 1}
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
          onClick={() => onLeave(entry.id)}
        >
          <LogOut className="size-4 me-2" />
          {t.waitlist.leaveWaitlist}
        </Button>
      </CardContent>
    </Card>
  );
}
