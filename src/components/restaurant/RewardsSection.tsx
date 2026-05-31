"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Gift, Search, Phone, Loader2, UserPlus, Trophy, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { toast } from "sonner";
import { RewardsBalance } from "./rewards/RewardsBalance";
import { RewardsTiers } from "./rewards/RewardsTiers";
import { RewardsHistory } from "./rewards/RewardsHistory";

/* ─── Types ─── */
interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  totalSpent: number;
  visits: number;
  createdAt: string;
}

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

interface RewardTier {
  id: string;
  nameEn: string;
  nameAr: string;
  points: number;
  icon: string;
  tier: string;
  sortOrder: number;
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
export function RewardsSection() {
  const { t, isRTL, locale } = useI18n();
  const customerPhone = useRestaurantStore((s) => s.customerPhone);
  const customerName = useRestaurantStore((s) => s.customerName);
  const setCustomerPhone = useRestaurantStore((s) => s.setCustomerPhone);
  const setCustomerName = useRestaurantStore((s) => s.setCustomerName);
  const settings = useRestaurantStore((s) => s.settings);
  const fetchSettings = useRestaurantStore((s) => s.fetchSettings);
  const currency = settings?.currencySymbol ?? "";

  const AMOUNT_PRESETS = settings?.giftCardAmounts
    ? settings.giftCardAmounts
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0)
    : [];

  // Account state
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lookupPhone, setLookupPhone] = useState(customerPhone || "");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Sign up
  const [signUpName, setSignUpName] = useState("");
  const [signUpPhone, setSignUpPhone] = useState(customerPhone || "");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showSignUp, setShowSignUp] = useState(false);

  // Gift card form
  const [gcTemplate, setGcTemplate] = useState<string>("birthday");
  const [gcAmount, setGcAmount] = useState<number>(50);
  const [gcCustomAmount, setGcCustomAmount] = useState<string>("");
  const [gcRecipient, setGcRecipient] = useState("");
  const [gcMessage, setGcMessage] = useState("");
  const [gcFrom, setGcFrom] = useState(customerName || "");
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Redeem
  const [redeemSparkle, setRedeemSparkle] = useState<number | null>(null);
  const [giftCards, setGiftCards] = useState<GiftCardData[]>([]);
  const [gcLookupName, setGcLookupName] = useState(customerName || "");
  const [isLoadingGc, setIsLoadingGc] = useState(false);

  // Reward tiers from database
  const [rewardTiers, setRewardTiers] = useState<RewardTier[]>([]);

  // Sync from store
  useEffect(() => {
    if (customerName && !gcFrom) setGcFrom(customerName);
    if (customerPhone && !signUpPhone) setSignUpPhone(customerPhone);
    if (customerPhone && !lookupPhone) setLookupPhone(customerPhone);
  }, [customerName, customerPhone]);

  // Fetch reward tiers and settings from API
  useEffect(() => {
    async function fetchTiers() {
      try {
        const res = await fetch("/api/reward-tiers");
        if (!res.ok) return;
        const data = await res.json();
        if (data.rewardTiers) setRewardTiers(data.rewardTiers);
      } catch {
        // Reward tiers unavailable
      }
    }
    fetchTiers();
    fetchSettings();
  }, [fetchSettings]);

  // Auto-lookup if phone is in store
  useEffect(() => {
    if (customerPhone && !customer && !hasSearched) {
      handleLookup(customerPhone);
    }
  }, []);

  /* ─── Look up account ─── */
  const handleLookup = async (phoneNum?: string) => {
    const num = phoneNum || lookupPhone;
    if (!num.trim()) return;
    setIsLookingUp(true);
    setLookupError(false);
    setHasSearched(true);
    try {
      const res = await fetch(
        `/api/customers?phone=${encodeURIComponent(num.trim())}`,
      );
      if (res.status === 404) {
        setCustomer(null);
        setLookupError(true);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCustomer(data.customer);
      setLookupError(false);
      setCustomerPhone(num.trim());
    } catch {
      setCustomer(null);
      setLookupError(true);
      toast.error(t.common.error);
    } finally {
      setIsLookingUp(false);
    }
  };

  /* ─── Sign up ─── */
  const handleSignUp = async () => {
    if (!signUpName || !signUpPhone) {
      toast.error(t.common.error, { description: t.common.requiredFields });
      return;
    }
    setIsSigningUp(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signUpName,
          phone: signUpPhone,
          email: signUpEmail || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create account");
      }
      const data = await res.json();
      setCustomer(data.customer);
      setCustomerPhone(signUpPhone);
      setCustomerName(signUpName);
      setShowSignUp(false);
      toast.success(t.rewards.createAccount);
    } catch (err) {
      toast.error(t.common.error, {
        description: err instanceof Error ? err.message : t.common.error,
      });
    } finally {
      setIsSigningUp(false);
    }
  };

  /* ─── Redeem reward ─── */
  const handleRedeem = async (points: number) => {
    if (!customer || customer.loyaltyPoints < points) return;
    setRedeemSparkle(points);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loyaltyPoints: customer.loyaltyPoints - points,
        }),
      });
      if (!res.ok) throw new Error("Failed to redeem");
      const data = await res.json();
      setCustomer(data.customer);
      toast.success(t.rewards.redeem, { description: t.rewards.redeemSuccess });
    } catch {
      toast.error(t.common.error);
    }
    setTimeout(() => setRedeemSparkle(null), 1500);
  };

  /* ─── Purchase gift card ─── */
  const handlePurchaseGc = async () => {
    const amount = gcCustomAmount ? parseFloat(gcCustomAmount) : gcAmount;
    if (!amount || amount <= 0 || !gcRecipient || !gcFrom) {
      toast.error(t.common.error, { description: t.common.requiredFields });
      return;
    }
    setIsPurchasing(true);
    try {
      const res = await fetch("/api/gift-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          purchaserName: gcFrom,
          recipientName: gcRecipient,
          message: gcMessage || undefined,
          template: gcTemplate,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to purchase");
      }
      toast.success(t.rewards.purchasedSuccess);
      setGcRecipient("");
      setGcMessage("");
      setGcCustomAmount("");
      if (gcFrom) fetchGiftCards(gcFrom);
    } catch (err) {
      toast.error(t.common.error, {
        description: err instanceof Error ? err.message : t.common.error,
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  /* ─── Fetch gift cards ─── */
  const fetchGiftCards = async (purchaserName: string) => {
    if (!purchaserName.trim()) return;
    setIsLoadingGc(true);
    try {
      const res = await fetch(
        `/api/gift-cards?purchaserName=${encodeURIComponent(purchaserName.trim())}`,
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setGiftCards(data.giftCards || []);
    } catch {
      setGiftCards([]);
    } finally {
      setIsLoadingGc(false);
    }
  };

  /* ─── Copy code ─── */
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t.common.copied);
  };

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        className="px-4 py-6 max-w-2xl mx-auto space-y-6"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div variants={fadeIn} className="text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.1,
            }}
            className="inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-rose-500/15 to-pink-500/15 border border-rose-500/20 mb-3"
          >
            <Gift className="size-8 text-rose-600 dark:text-rose-400" />
          </motion.div>
          <h1 className="text-2xl font-bold">{t.rewards.title}</h1>
          <p className="text-muted-foreground mt-1">{t.rewards.subtitle}</p>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeIn}>
          <Tabs defaultValue="rewards" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="rewards" className="flex-1">
                <Trophy className="size-4 me-1.5" />
                {t.rewards.rewardsTab}
              </TabsTrigger>
              <TabsTrigger value="giftcards" className="flex-1">
                <CreditCard className="size-4 me-1.5" />
                {t.rewards.giftCardsTab}
              </TabsTrigger>
            </TabsList>

            {/* REWARDS TAB */}
            <TabsContent value="rewards" className="space-y-6 mt-4">
              {/* Lookup / Account */}
              {!customer ? (
                <Card className="shadow-sm border-border/50">
                  <CardContent className="pt-6 space-y-4">
                    {!showSignUp ? (
                      <>
                        <div className="text-center">
                          <Search className="size-10 text-muted-foreground mx-auto mb-2" />
                          <p className="font-medium">{t.rewards.lookupPhone}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.rewards.lookupDesc}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Phone className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                            <Input
                              placeholder={t.rewards.phonePlaceholder}
                              value={lookupPhone}
                              onChange={(e) => setLookupPhone(e.target.value)}
                              className="ps-9"
                              type="tel"
                            />
                          </div>
                          <Button
                            onClick={() => handleLookup()}
                            disabled={isLookingUp || !lookupPhone.trim()}
                          >
                            {isLookingUp ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Search className="size-4" />
                            )}
                          </Button>
                        </div>
                        {lookupError && hasSearched && (
                          <div className="text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              {t.rewards.notOnList}
                            </p>
                            <Button
                              variant="outline"
                              onClick={() => setShowSignUp(true)}
                            >
                              <UserPlus className="size-4 me-2" />
                              {t.rewards.signUp}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center">
                          <UserPlus className="size-10 text-primary mx-auto mb-2" />
                          <p className="font-medium">{t.rewards.signUp}</p>
                          <p className="text-sm text-muted-foreground">
                            {t.rewards.signUpDesc}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t.rewards.name}</Label>
                          <Input
                            placeholder={t.rewards.namePlaceholder}
                            value={signUpName}
                            onChange={(e) => setSignUpName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t.rewards.phoneLabel}</Label>
                          <Input
                            placeholder={t.rewards.phonePlaceholder}
                            value={signUpPhone}
                            onChange={(e) => setSignUpPhone(e.target.value)}
                            type="tel"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>{t.rewards.email}</Label>
                          <Input
                            placeholder={t.rewards.emailPlaceholder}
                            value={signUpEmail}
                            onChange={(e) => setSignUpEmail(e.target.value)}
                            type="email"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={handleSignUp}
                          disabled={isSigningUp}
                        >
                          {isSigningUp ? (
                            <Loader2 className="size-4 animate-spin me-2" />
                          ) : (
                            <UserPlus className="size-4 me-2" />
                          )}
                          {t.rewards.createAccount}
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => setShowSignUp(false)}
                        >
                          {t.common.back}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <RewardsBalance
                    customer={customer}
                    rewardTiers={rewardTiers}
                    currency={currency}
                  />
                  <RewardsTiers
                    customer={customer}
                    rewardTiers={rewardTiers}
                    redeemSparkle={redeemSparkle}
                    onRedeem={handleRedeem}
                  />
                </>
              )}
            </TabsContent>

            {/* GIFT CARDS TAB */}
            <TabsContent value="giftcards" className="space-y-6 mt-4">
              <RewardsHistory
                customerName={customerName}
                gcTemplate={gcTemplate}
                setGcTemplate={setGcTemplate}
                gcAmount={gcAmount}
                setGcAmount={setGcAmount}
                gcCustomAmount={gcCustomAmount}
                setGcCustomAmount={setGcCustomAmount}
                gcRecipient={gcRecipient}
                setGcRecipient={setGcRecipient}
                gcMessage={gcMessage}
                setGcMessage={setGcMessage}
                gcFrom={gcFrom}
                setGcFrom={setGcFrom}
                isPurchasing={isPurchasing}
                handlePurchaseGc={handlePurchaseGc}
                giftCards={giftCards}
                gcLookupName={gcLookupName}
                setGcLookupName={setGcLookupName}
                isLoadingGc={isLoadingGc}
                fetchGiftCards={fetchGiftCards}
                copyCode={copyCode}
                amountPresets={AMOUNT_PRESETS}
                currency={currency}
              />
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-4" />
      </motion.div>
    </div>
  );
}
