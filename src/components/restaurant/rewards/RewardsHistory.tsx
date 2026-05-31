'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Sparkles, Search, Loader2, AlertCircle, Copy,
} from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';

/* ─── Types ─── */
interface GiftCardData {
  id: string;
  code: string;
  amount: number;
  balance: number;
  purchaserName: string;
  recipientName: string;
  message: string | null;
  template: string;
  isRedeemed: boolean;
  createdAt: string;
}

/* ─── Gift card templates ─── */
const CARD_TEMPLATES = [
  { key: "birthday", gradient: "from-pink-500 to-orange-400", icon: "🎂" },
  { key: "thank_you", gradient: "from-teal-500 to-emerald-400", icon: "🙏" },
  { key: "holiday", gradient: "from-red-500 to-amber-400", icon: "🎄" },
] as const;

function getTemplateGradient(key: string) {
  const tmpl = CARD_TEMPLATES.find((t) => t.key === key);
  return tmpl?.gradient || "from-gray-500 to-gray-400";
}

function getTemplateIcon(key: string) {
  const tmpl = CARD_TEMPLATES.find((t) => t.key === key);
  return tmpl?.icon || "🎁";
}

export function RewardsHistory({
  customerName,
  gcTemplate,
  setGcTemplate,
  gcAmount,
  setGcAmount,
  gcCustomAmount,
  setGcCustomAmount,
  gcRecipient,
  setGcRecipient,
  gcMessage,
  setGcMessage,
  gcFrom,
  setGcFrom,
  isPurchasing,
  handlePurchaseGc,
  giftCards,
  gcLookupName,
  setGcLookupName,
  isLoadingGc,
  fetchGiftCards,
  copyCode,
  amountPresets,
  currency,
}: {
  customerName: string;
  gcTemplate: string;
  setGcTemplate: (v: string) => void;
  gcAmount: number;
  setGcAmount: (v: number) => void;
  gcCustomAmount: string;
  setGcCustomAmount: (v: string) => void;
  gcRecipient: string;
  setGcRecipient: (v: string) => void;
  gcMessage: string;
  setGcMessage: (v: string) => void;
  gcFrom: string;
  setGcFrom: (v: string) => void;
  isPurchasing: boolean;
  handlePurchaseGc: () => void;
  giftCards: GiftCardData[];
  gcLookupName: string;
  setGcLookupName: (v: string) => void;
  isLoadingGc: boolean;
  fetchGiftCards: (name: string) => void;
  copyCode: (code: string) => void;
  amountPresets: number[];
  currency: string;
}) {
  const { t } = useI18n();

  const effectiveAmount = gcCustomAmount
    ? parseFloat(gcCustomAmount) || 0
    : gcAmount;

  return (
    <>
      {/* Buy Gift Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="size-4 text-primary" />
            </div>
            {t.rewards.buyGiftCard}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selection */}
          <div className="space-y-1.5">
            <Label>{t.rewards.selectTemplate}</Label>
            <div className="grid grid-cols-3 gap-2">
              {CARD_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.key}
                  onClick={() => setGcTemplate(tmpl.key)}
                  className={`relative rounded-lg border-2 p-2 text-center transition-all ${
                    gcTemplate === tmpl.key
                      ? "border-primary shadow-sm"
                      : "border-transparent hover:border-muted"
                  }`}
                >
                  <span className="text-xl">{tmpl.icon}</span>
                  <p className="text-[10px] mt-1 font-medium">
                    {t.rewards.template[tmpl.key]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>{t.rewards.balance}</Label>
            <div className="flex flex-wrap gap-2">
              {amountPresets.map((amt) => (
                <Button
                  key={amt}
                  variant={gcAmount === amt && !gcCustomAmount ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setGcAmount(amt);
                    setGcCustomAmount("");
                  }}
                >
                  {currency}
                  {amt}
                </Button>
              ))}
              <div className="relative">
                <Input
                  placeholder={t.rewards.customAmount}
                  value={gcCustomAmount}
                  onChange={(e) => setGcCustomAmount(e.target.value)}
                  className="w-24 h-9 text-sm"
                  type="number"
                  min="1"
                />
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-1.5">
            <Label>{t.rewards.recipient}</Label>
            <Input
              placeholder={t.rewards.recipientPlaceholder}
              value={gcRecipient}
              onChange={(e) => setGcRecipient(e.target.value)}
            />
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label>{t.rewards.message}</Label>
            <Textarea
              placeholder={t.rewards.messagePlaceholder}
              value={gcMessage}
              onChange={(e) => setGcMessage(e.target.value)}
              rows={2}
            />
          </div>

          {/* From */}
          <div className="space-y-1.5">
            <Label>{t.rewards.from}</Label>
            <Input
              placeholder={t.rewards.fromPlaceholder}
              value={gcFrom}
              onChange={(e) => setGcFrom(e.target.value)}
            />
          </div>

          {/* Preview */}
          {gcRecipient && effectiveAmount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl overflow-hidden shadow-lg"
            >
              <div
                className={`bg-gradient-to-br ${getTemplateGradient(gcTemplate)} p-5 text-white relative`}
              >
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-2 start-2 size-8 rounded-full border-2 border-white" />
                  <div className="absolute top-6 start-6 size-4 rounded-full border border-white" />
                  <div className="absolute bottom-4 end-4 size-12 rounded-full border-2 border-white" />
                  <div className="absolute bottom-8 end-8 size-6 rounded-full border border-white" />
                  <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-20 rounded-full border border-white" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-2xl">
                      {getTemplateIcon(gcTemplate)}
                    </span>
                    <span className="text-xs font-medium opacity-80">
                      {t.app.name}
                    </span>
                  </div>
                  <p className="text-xl font-bold mb-1">
                    {currency}
                    {effectiveAmount.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-90 mb-3">
                    {t.admin.to}: {gcRecipient}
                  </p>
                  {gcMessage && (
                    <p className="text-xs opacity-75 italic line-clamp-2">
                      &ldquo;{gcMessage}&rdquo;
                    </p>
                  )}
                  <p className="text-xs opacity-60 mt-2">
                    {t.admin.from || "From"}: {gcFrom}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Purchase */}
          <Button
            className="w-full"
            size="lg"
            onClick={handlePurchaseGc}
            disabled={
              isPurchasing ||
              !gcRecipient ||
              !gcFrom ||
              effectiveAmount <= 0
            }
          >
            {isPurchasing ? (
              <Loader2 className="size-4 animate-spin me-2" />
            ) : (
              <Sparkles className="size-4 me-2" />
            )}
            {t.rewards.purchase}
          </Button>
        </CardContent>
      </Card>

      {/* My Gift Cards */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t.rewards.myGiftCards}
          </CardTitle>
          <CardDescription>{t.rewards.lookupGiftCards}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder={t.rewards.fromPlaceholder}
              value={gcLookupName}
              onChange={(e) => setGcLookupName(e.target.value)}
            />
            <Button
              onClick={() => fetchGiftCards(gcLookupName)}
              disabled={isLoadingGc || !gcLookupName.trim()}
            >
              {isLoadingGc ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {giftCards.length === 0 && gcLookupName && !isLoadingGc ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-6"
              >
                <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2">
                  <AlertCircle className="size-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t.rewards.noGiftCards}
                </p>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 max-h-64 overflow-y-auto"
              >
                {giftCards.map((gc) => (
                  <div
                    key={gc.id}
                    className="p-3 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {getTemplateIcon(gc.template)}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {currency}
                            {gc.balance.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t.admin.to}: {gc.recipientName}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={gc.isRedeemed ? "outline" : "default"}
                        className={
                          gc.isRedeemed
                            ? ""
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
                        }
                      >
                        {gc.isRedeemed
                          ? t.rewards.redeemed
                          : t.rewards.active}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        {gc.code}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyCode(gc.code)}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </>
  );
}
