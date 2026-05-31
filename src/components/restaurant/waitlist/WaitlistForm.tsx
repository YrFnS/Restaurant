"use client";

import React from "react";
import { UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface WaitlistFormProps {
  name: string;
  phone: string;
  partySize: number;
  isJoining: boolean;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onPartySizeChange: (v: number) => void;
  onSubmit: () => void;
}

export function WaitlistForm({
  name, phone, partySize, isJoining,
  onNameChange, onPhoneChange, onPartySizeChange, onSubmit,
}: WaitlistFormProps) {
  const { t } = useI18n();

  return (
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
            onChange={(e) => onNameChange(e.target.value)}
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
            onChange={(e) => onPhoneChange(e.target.value)}
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
                onClick={() => onPartySizeChange(size)}
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
          onClick={onSubmit}
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
  );
}
