"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Gift, Star, Award, TrendingUp, ArrowLeft, ArrowRight, Sparkles, Crown } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const tierColors: Record<string, string> = {
  bronze: "from-amber-600 to-amber-800",
  silver: "from-slate-400 to-slate-600",
  gold: "from-yellow-400 to-yellow-600",
  platinum: "from-violet-400 to-fuchsia-600",
};

export function RewardsSection() {
  const { t, isRTL, fmtNumber } = useI18n();
  const { customerPhone, setActiveSection } = useRestaurantStore();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [phone, setPhone] = useState(customerPhone || "");
  const [searched, setSearched] = useState(!!customerPhone);

  const { data } = useQuery({
    queryKey: ["rewards", phone],
    queryFn: async () => (await fetch(`/api/reward-tiers?phone=${encodeURIComponent(phone)}`)).json(),
    enabled: searched && !!phone,
  });
  const tiers: any[] = data?.tiers || [];
  const customer = data?.customer;

  const currentTier = customer ? [...tiers].reverse().find((t) => customer.loyaltyPoints >= t.points) || tiers[0] : null;
  const nextTier = customer ? tiers.find((t) => t.points > customer.loyaltyPoints) : null;
  const progress = currentTier && nextTier
    ? Math.round(((customer.loyaltyPoints - currentTier.points) / (nextTier.points - currentTier.points)) * 100)
    : 100;

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 md:px-6 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => setActiveSection("home")}><Arrow className="size-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="size-6 text-primary" />{t.rewards.title}</h1>
          <p className="text-sm text-muted-foreground">{t.rewards.subtitle}</p>
        </div>
      </div>

      {/* Phone lookup */}
      {!customer && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">{t.rewards.enterPhone}</label>
            <div className="flex gap-2">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.cart.customerPhone} dir="ltr" onKeyDown={(e) => e.key === "Enter" && setSearched(true)} />
              <Button onClick={() => setSearched(true)}>{t.rewards.lookup}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {customer && currentTier && (
        <>
          {/* Points card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden mb-6">
              <div className={`bg-gradient-to-br ${tierColors[currentTier.tier] || tierColors.bronze} p-6 text-white`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white/80 text-sm">{t.rewards.yourPoints}</p>
                    <p className="text-4xl font-bold" dir="ltr">{fmtNumber(customer.loyaltyPoints)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/80 text-sm">{t.rewards.yourTier}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-2xl">{currentTier.icon}</span>
                      <span className="font-bold text-lg">{isRTL ? currentTier.nameAr : currentTier.nameEn}</span>
                    </div>
                  </div>
                </div>
                {nextTier && (
                  <div>
                    <div className="flex justify-between text-xs text-white/90 mb-1">
                      <span>{t.rewards.pointsToNext.replace("{points}", String(nextTier.points - customer.loyaltyPoints))}</span>
                      <span>{isRTL ? nextTier.nameAr : nextTier.nameEn}</span>
                    </div>
                    <Progress value={progress} className="h-2 bg-white/20" />
                  </div>
                )}
              </div>
              <CardContent className="p-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary" dir="ltr">{fmtNumber(customer.visits)}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "زيارات" : "Visits"}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">${fmtNumber(Math.round(customer.totalSpent))}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? "إجمالي الإنفاق" : "Total Spent"}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{currentTier.icon}</p>
                  <p className="text-xs text-muted-foreground">{isRTL ? currentTier.nameAr : currentTier.nameEn}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* How it works */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { icon: <TrendingUp className="size-7" />, title: t.rewards.earnPoints, desc: t.rewards.earnPointsDesc },
          { icon: <Gift className="size-7" />, title: t.rewards.redeemRewards, desc: t.rewards.redeemRewardsDesc },
          { icon: <Crown className="size-7" />, title: t.rewards.enjoyPerks, desc: t.rewards.enjoyPerksDesc },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-5 text-center">
              <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary/10 text-primary mb-3">{s.icon}</div>
              <h3 className="font-bold mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tiers */}
      <h2 className="font-bold text-lg mb-3">{t.rewards.rewardTiers}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiers.map((tier, idx) => (
          <motion.div key={tier.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}>
            <Card className={customer && currentTier?.id === tier.id ? "border-primary" : ""}>
              <CardContent className="p-5 text-center">
                <div className={`inline-flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br ${tierColors[tier.tier]} text-white text-3xl mb-3`}>{tier.icon}</div>
                <h3 className="font-bold">{isRTL ? tier.nameAr : tier.nameEn}</h3>
                <p className="text-xs text-muted-foreground mb-2" dir="ltr">{fmtNumber(tier.points)}+ pts</p>
                <p className="text-xs text-muted-foreground">{isRTL ? tier.perkAr : tier.perkEn}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
