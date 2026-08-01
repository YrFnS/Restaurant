"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GiftCardLookup } from "./GiftCardLookup";
import {
  ArrowLeft,
  ArrowRight,
  Crown,
  Gift,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const tierColors: Record<string, string> = {
  bronze: "from-amber-600 to-amber-800",
  silver: "from-slate-400 to-slate-600",
  gold: "from-yellow-400 to-yellow-600",
  platinum: "from-violet-400 to-fuchsia-600",
};

export function RewardsSection() {
  const { t, isRTL, fmtNumber } = useI18n();
  const { recentOrders, setActiveSection } = useRestaurantStore();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const tiersQuery = useQuery({
    queryKey: ["reward-tiers"],
    queryFn: async () => {
      const response = await fetch("/api/reward-tiers");
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || t.common.error);
      return data;
    },
  });
  const credentialsFingerprint = useMemo(
    () => JSON.stringify(recentOrders),
    [recentOrders]
  );
  const loyaltyQuery = useQuery({
    queryKey: ["customer-loyalty", credentialsFingerprint],
    enabled: recentOrders.length > 0,
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/customers/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: recentOrders }),
      });
      const data = await response.json().catch(() => null);
      if (response.status === 404) return { customer: null };
      if (!response.ok) throw new Error(data?.error || t.common.error);
      return data;
    },
  });

  const tiers: any[] = tiersQuery.data?.tiers || [];
  const customer = loyaltyQuery.data?.customer;
  const currentTier = customer
    ? [...tiers]
        .reverse()
        .find((tier) => customer.loyaltyPoints >= tier.points) || tiers[0]
    : null;
  const nextTier = customer
    ? tiers.find((tier) => tier.points > customer.loyaltyPoints)
    : null;
  const progress =
    currentTier && nextTier
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((customer.loyaltyPoints - currentTier.points) /
                (nextTier.points - currentTier.points)) *
                100
            )
          )
        )
      : 100;

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setActiveSection("home")}
        >
          <Arrow className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gift className="size-6 text-primary" />
            {t.rewards.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.rewards.subtitle}
          </p>
        </div>
      </div>

      {!customer && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex items-start gap-3">
            <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold">
                {isRTL ? "حساب الولاء محمي" : "Your loyalty account is protected"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {recentOrders.length > 0
                  ? isRTL
                    ? "لم نتمكن من ربط الطلبات المحفوظة بحساب ولاء. استخدم رقم الهاتف نفسه عند إنشاء طلب جديد."
                    : "The saved orders are not linked to a loyalty account. Use the same phone number on a new order."
                  : isRTL
                    ? "أنشئ طلباً أو افتح رابط تأكيد طلب سابق على هذا الجهاز لعرض نقاطك بأمان."
                    : "Place an order or open a previous secure confirmation link on this device to view your points."}
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => setActiveSection("menu")}
              >
                {t.cart.browseMenu}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loyaltyQuery.isError && (
        <Card className="mb-6">
          <CardContent className="p-4 text-sm text-destructive">
            {loyaltyQuery.error instanceof Error
              ? loyaltyQuery.error.message
              : t.common.error}
          </CardContent>
        </Card>
      )}

      {customer && currentTier && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="overflow-hidden mb-6">
            <div
              className={`bg-gradient-to-br ${
                tierColors[currentTier.tier] || tierColors.bronze
              } p-6 text-white`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/80 text-sm">
                    {t.rewards.yourPoints}
                  </p>
                  <p className="text-4xl font-bold" dir="ltr">
                    {fmtNumber(customer.loyaltyPoints)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-white/80 text-sm">
                    {t.rewards.yourTier}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl">{currentTier.icon}</span>
                    <span className="font-bold text-lg">
                      {isRTL ? currentTier.nameAr : currentTier.nameEn}
                    </span>
                  </div>
                </div>
              </div>
              {nextTier && (
                <div>
                  <div className="flex justify-between text-xs text-white/90 mb-1">
                    <span>
                      {t.rewards.pointsToNext.replace(
                        "{points}",
                        String(nextTier.points - customer.loyaltyPoints)
                      )}
                    </span>
                    <span>{isRTL ? nextTier.nameAr : nextTier.nameEn}</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-white/20" />
                </div>
              )}
            </div>
            <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary" dir="ltr">
                  {fmtNumber(customer.visits)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "زيارات" : "Visits"}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  ${fmtNumber(Math.round(customer.totalSpent))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? "إجمالي الإنفاق" : "Total Spent"}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">
                  {currentTier.icon}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? currentTier.nameAr : currentTier.nameEn}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: <TrendingUp className="size-7" />,
            title: t.rewards.earnPoints,
            desc: t.rewards.earnPointsDesc,
          },
          {
            icon: <Gift className="size-7" />,
            title: t.rewards.redeemRewards,
            desc: t.rewards.redeemRewardsDesc,
          },
          {
            icon: <Crown className="size-7" />,
            title: t.rewards.enjoyPerks,
            desc: t.rewards.enjoyPerksDesc,
          },
        ].map((step) => (
          <Card key={step.title}>
            <CardContent className="p-5 text-center">
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 text-primary mb-3">
                {step.icon}
              </div>
              <h3 className="font-bold mb-1">{step.title}</h3>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <GiftCardLookup />

      <h2 className="font-bold text-lg mb-3">{t.rewards.rewardTiers}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((tier, index) => (
          <motion.div
            key={tier.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card
              className={
                customer && currentTier?.id === tier.id ? "border-primary" : ""
              }
            >
              <CardContent className="p-5 text-center">
                <div
                  className={`inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br ${tierColors[tier.tier]} text-white text-3xl mb-3`}
                >
                  {tier.icon}
                </div>
                <h3 className="font-bold">
                  {isRTL ? tier.nameAr : tier.nameEn}
                </h3>
                <p className="text-xs text-muted-foreground mb-2" dir="ltr">
                  {fmtNumber(tier.points)}+ pts
                </p>
                <p className="text-xs text-muted-foreground">
                  {isRTL ? tier.perkAr : tier.perkEn}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
