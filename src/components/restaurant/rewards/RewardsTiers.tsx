'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Gift, ShoppingBag, ArrowRightLeft, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';

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

interface RewardTier {
  id: string;
  nameEn: string;
  nameAr: string;
  points: number;
  icon: string;
  tier: string;
  sortOrder: number;
}

export function RewardsTiers({
  customer,
  rewardTiers,
  redeemSparkle,
  onRedeem,
}: {
  customer: Customer | null;
  rewardTiers: RewardTier[];
  redeemSparkle: number | null;
  onRedeem: (points: number) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <>
      {/* How It Works */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t.rewards.howItWorks}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { icon: ShoppingBag, label: t.rewards.step1, num: "1" },
              { icon: ArrowRightLeft, label: t.rewards.step2, num: "2" },
              { icon: Gift, label: t.rewards.step3, num: "3" },
            ].map((step) => (
              <div key={step.num} className="flex items-center gap-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                  {step.num}
                </div>
                <step.icon className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{step.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Rewards */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t.rewards.rewards}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rewardTiers.map((tier) => {
            const canRedeem = customer ? customer.loyaltyPoints >= tier.points : false;
            return (
              <div
                key={tier.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  canRedeem ? "hover:shadow-md hover:border-primary/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <motion.span
                    animate={
                      canRedeem
                        ? { scale: [1, 1.15, 1] }
                        : { scale: 1 }
                    }
                    transition={{
                      repeat: canRedeem ? Infinity : 0,
                      duration: 2,
                      ease: "easeInOut",
                    }}
                    className="text-2xl"
                  >
                    {tier.icon}
                  </motion.span>
                  <div>
                    <p className="font-medium text-sm">
                      {locale === "ar" ? tier.nameAr : tier.nameEn}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full tier-badge-${tier.tier}`}
                      >
                        {tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {tier.points} {t.rewards.pointsNeeded}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <Button
                    size="sm"
                    variant={canRedeem ? "default" : "outline"}
                    disabled={!canRedeem}
                    onClick={() => onRedeem(tier.points)}
                  >
                    {canRedeem ? t.rewards.redeem : t.rewards.notEnoughPoints}
                  </Button>
                  {redeemSparkle === tier.points && (
                    <>
                      <motion.span
                        className="absolute -top-3 start-2 text-sm pointer-events-none"
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 1.5, opacity: 0, y: -15 }}
                        transition={{ duration: 0.8 }}
                      >
                        ✨
                      </motion.span>
                      <motion.span
                        className="absolute -top-2 end-0 text-xs pointer-events-none"
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 1.2, opacity: 0, y: -10 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                      >
                        ⭐
                      </motion.span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
