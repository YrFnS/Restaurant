"use client";

import React from "react";
import { Send, Loader2, Star, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

interface ContactFormProps {
  feedbackName: string;
  feedbackEmail: string;
  feedback: string;
  rating: number;
  hoverRating: number;
  isSending: boolean;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onFeedbackChange: (v: string) => void;
  onRatingClick: (star: number) => void;
  onRatingHover: (star: number) => void;
  onRatingLeave: () => void;
  onSend: () => void;
}

export function ContactForm({
  feedbackName, feedbackEmail, feedback, rating, hoverRating, isSending,
  onNameChange, onEmailChange, onFeedbackChange,
  onRatingClick, onRatingHover, onRatingLeave, onSend,
}: ContactFormProps) {
  const { t } = useI18n();

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="size-4 text-primary" />
          </div>
          {t.contact.feedback}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{t.contact.feedbackName}</p>
          <Input
            placeholder={t.contact.feedbackNamePlaceholder}
            value={feedbackName}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{t.contact.feedbackEmail}</p>
          <Input
            type="email"
            placeholder={t.contact.feedbackEmailPlaceholder}
            value={feedbackEmail}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>

        {/* Star Rating */}
        <div className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{t.contact.rating}</p>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onRatingClick(star)}
                onMouseEnter={() => onRatingHover(star)}
                onMouseLeave={onRatingLeave}
                className="transition-transform hover:scale-110"
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
              >
                <Star
                  className={`size-7 ${
                    star <= (hoverRating || rating)
                      ? "text-amber-400 fill-amber-400"
                      : "text-muted-foreground/30"
                  } transition-colors`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="text-sm text-muted-foreground ms-2">{rating}/5</span>
            )}
          </div>
        </div>

        {/* Feedback Text */}
        <Textarea
          placeholder={t.contact.feedbackPlaceholder}
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          rows={4}
        />

        {/* Send */}
        <Button
          className="w-full"
          onClick={onSend}
          disabled={isSending || !feedback.trim() || !feedbackName.trim() || rating === 0}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin me-2" />
          ) : (
            <Send className="size-4 me-2" />
          )}
          {t.contact.send}
        </Button>
      </CardContent>
    </Card>
  );
}
