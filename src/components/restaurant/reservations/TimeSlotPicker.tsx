"use client";

import React from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n";

interface TimeSlotPickerProps {
  date: Date | undefined;
  time: string;
  timeSlots: string[];
  onDateChange: (date: Date | undefined) => void;
  onTimeChange: (time: string) => void;
}

export function TimeSlotPicker({ date, time, timeSlots, onDateChange, onTimeChange }: TimeSlotPickerProps) {
  const { t } = useI18n();

  return (
    <>
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
              onSelect={onDateChange}
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
          {timeSlots.map((slot) => {
            const isSelected = time === slot;
            const isPast = date && new Date().toDateString() === date.toDateString() && parseInt(slot.split(":")[0]) <= new Date().getHours();
            return (
              <motion.button
                key={slot}
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                onClick={() => !isPast && onTimeChange(slot)}
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
        <Select value={time} onValueChange={onTimeChange}>
          <SelectTrigger>
            <Clock className="size-4 me-2 shrink-0 text-muted-foreground" />
            <SelectValue placeholder={t.reservations.selectTime} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {timeSlots.map((slot) => (
              <SelectItem key={slot} value={slot}>
                {slot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
