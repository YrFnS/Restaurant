"use client";

import React from "react";
import {
  UtensilsCrossed,
  PartyPopper,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useI18n } from "@/lib/i18n";
import { TimeSlotPicker } from "./TimeSlotPicker";

interface ReservationFormProps {
  name: string;
  phone: string;
  email: string;
  partySize: number;
  date: Date | undefined;
  time: string;
  occasion: string;
  preference: string;
  notes: string;
  timeSlots: string[];
  isSubmitting: boolean;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPartySizeChange: (v: number) => void;
  onDateChange: (v: Date | undefined) => void;
  onTimeChange: (v: string) => void;
  onOccasionChange: (v: string) => void;
  onPreferenceChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onSubmit: () => void;
}

export function ReservationForm({
  name, phone, email, partySize, date, time, occasion, preference, notes,
  timeSlots, isSubmitting,
  onNameChange, onPhoneChange, onEmailChange, onPartySizeChange,
  onDateChange, onTimeChange, onOccasionChange, onPreferenceChange, onNotesChange,
  onSubmit,
}: ReservationFormProps) {
  const { t } = useI18n();

  return (
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
            onChange={(e) => onNameChange(e.target.value)}
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
            onChange={(e) => onPhoneChange(e.target.value)}
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
            onChange={(e) => onEmailChange(e.target.value)}
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
                onClick={() => onPartySizeChange(size)}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>

        {/* Date & Time */}
        <TimeSlotPicker
          date={date}
          time={time}
          timeSlots={timeSlots}
          onDateChange={onDateChange}
          onTimeChange={onTimeChange}
        />

        {/* Occasion */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t.reservations.occasion}</Label>
          <Select value={occasion} onValueChange={onOccasionChange}>
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
          <RadioGroup value={preference} onValueChange={onPreferenceChange} className="grid grid-cols-2 gap-2">
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
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="bg-muted/30 border-0 focus-visible:ring-1 focus-visible:ring-primary resize-none"
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          onClick={onSubmit}
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
  );
}
