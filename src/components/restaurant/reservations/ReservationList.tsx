"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  CalendarDays,
  Clock,
  Users,
  Phone,
  Search,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

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

interface ReservationListProps {
  lookupPhone: string;
  reservations: Reservation[];
  isLoadingReservations: boolean;
  hasSearched: boolean;
  onLookupPhoneChange: (v: string) => void;
  onSearch: () => void;
  onCancel: (id: string) => void;
}

export function ReservationList({
  lookupPhone, reservations, isLoadingReservations, hasSearched,
  onLookupPhoneChange, onSearch, onCancel,
}: ReservationListProps) {
  const { t, isRTL } = useI18n();

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
              onChange={(e) => onLookupPhoneChange(e.target.value)}
              className="ps-9"
              type="tel"
            />
          </div>
          <Button
            onClick={onSearch}
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
                          onClick={() => onCancel(res.id)}
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
  );
}
