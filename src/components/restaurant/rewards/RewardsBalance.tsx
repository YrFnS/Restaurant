'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
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

export function RewardsBalance({
  customer,
  rewardTiers,
  currency,
}: {
  customer: Customer;
  rewardTiers: RewardTier[];
  currency: string;
}) {
  const { t, locale } = useI18n();

  const getNextReward = () => {
    if (!customer || rewardTiers.length === 0) return null;
    const points = customer.loyaltyPoints;
    for (const tier of rewardTiers) {
      if (points < tier.points) {
        return {
          ...tier,
          remaining: tier.points - points,
          progress: (points / tier.points) * 100,
        };
      }
    }
    return null;
  };
  const nextReward = getNextReward();

  return (
    <Card className="border-primary/20 shadow-sm">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t.rewards.welcomeBack}
            </p>
            <p className="text-lg font-bold">{customer.name}</p>
          </div>
          <div className="text-end">
            <p className="text-sm text-muted-foreground">
              {t.rewards.memberSince}
            </p>
            <p className="text-sm font-medium">
              {format(new Date(customer.createdAt), "MMM yyyy")}
            </p>
          </div>
        </div>

        <hr className="border-border" />

        {/* Points balance */}
        <div className="text-center py-2">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "easeInOut",
            }}
            className="inline-flex items-center justify-center size-20 rounded-full bg-primary/10 mb-2"
          >
            <Star className="size-10 text-primary" />
          </motion.div>
          <p className="text-4xl font-bold text-primary">
            {customer.loyaltyPoints}
          </p>
          <p className="text-sm text-muted-foreground">
            {t.rewards.yourPoints}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">
              {currency}
              {customer.totalSpent.toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.rewards.totalSpent}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{customer.visits}</p>
            <p className="text-xs text-muted-foreground">
              {t.rewards.visits}
            </p>
          </div>
        </div>

        {/* Next reward progress */}
        {nextReward && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {t.rewards.nextReward}
              </span>
              <span className="font-medium">
                {nextReward.remaining} {t.rewards.pointsToNext}
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 rounded-full progress-glow"
                initial={{ width: "0%" }}
                animate={{ width: `${nextReward.progress}%` }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {nextReward.icon}{" "}
              {locale === "ar"
                ? nextReward.nameAr
                : nextReward.nameEn}{" "}
                — {nextReward.points} {t.rewards.pointsNeeded}
            </p>
          </div>
        )}

        <p className="text-xs text-center text-muted-foreground">
          {t.rewards.earnMore}
        </p>
      </CardContent>
    </Card>
  );
}
