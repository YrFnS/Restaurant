"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Star, MessageSquare, TrendingUp, ThumbsUp, ThumbsDown, Meh } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function AdminFeedbackPage() {
  const { t, isRTL, fmtDate, fmtRelative, fmtNumber } = useI18n();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;

  const { data, isLoading } = useQuery({
    queryKey: ["feedback"],
    queryFn: async () => (await fetch("/api/feedback")).json(),
  });
  const feedback: any[] = data?.feedback || [];

  const avgRating = feedback.length > 0 ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length : 0;
  const positive = feedback.filter((f) => f.rating >= 4).length;
  const neutral = feedback.filter((f) => f.rating === 3).length;
  const negative = feedback.filter((f) => f.rating <= 2).length;
  const ratingDist = [5, 4, 3, 2, 1].map((r) => ({ rating: r, count: feedback.filter((f) => f.rating === r).length }));

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <MessageSquare className="size-5 text-primary" />
                {isRTL ? "آراء العملاء" : "Customer Feedback"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "تقييمات وتعليقات العملاء" : "Ratings and reviews from customers"}
              </p>
            </div>
          </div>
          <Badge variant="secondary">{feedback.length} {isRTL ? "تقييم" : "reviews"}</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : feedback.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent className="p-8">
              <MessageSquare className="size-12 mx-auto text-muted-foreground/40 mb-3" />
              <h2 className="font-bold text-lg mb-1">{isRTL ? "لا توجد تقييمات بعد" : "No feedback yet"}</h2>
              <p className="text-muted-foreground text-sm">{isRTL ? "ستظهر تقييمات العملاء هنا" : "Customer reviews will appear here"}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "متوسط التقييم" : "Avg Rating"}</span>
                    <Star className="size-4 text-amber-500 fill-amber-500" />
                  </div>
                  <div className="text-2xl font-bold">{avgRating.toFixed(1)}</div>
                  <div className="flex gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`size-3 ${n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "إيجابي" : "Positive"}</span>
                    <ThumbsUp className="size-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">{positive}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{feedback.length > 0 ? Math.round((positive / feedback.length) * 100) : 0}% {isRTL ? "من الإجمالي" : "of total"}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "محايد" : "Neutral"}</span>
                    <Meh className="size-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{neutral}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{feedback.length > 0 ? Math.round((neutral / feedback.length) * 100) : 0}% {isRTL ? "من الإجمالي" : "of total"}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-500/5 to-red-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "سلبي" : "Negative"}</span>
                    <ThumbsDown className="size-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-bold text-red-600">{negative}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{feedback.length > 0 ? Math.round((negative / feedback.length) * 100) : 0}% {isRTL ? "من الإجمالي" : "of total"}</div>
                </CardContent>
              </Card>
            </div>

            {/* Rating distribution */}
            <Card>
              <CardContent className="p-5">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  {isRTL ? "توزيع التقييمات" : "Rating Distribution"}
                </h3>
                <div className="space-y-2">
                  {ratingDist.map((r) => {
                    const pct = feedback.length > 0 ? (r.count / feedback.length) * 100 : 0;
                    return (
                      <div key={r.rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1 w-16 shrink-0">
                          <span className="text-sm font-medium">{r.rating}</span>
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                        </div>
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.5 }}
                            className={`h-full rounded-full ${r.rating >= 4 ? "bg-green-500" : r.rating === 3 ? "bg-amber-500" : "bg-red-500"}`}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-end shrink-0">{r.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Feedback list */}
            <div>
              <h3 className="font-bold text-sm mb-3">{isRTL ? "كل التقييمات" : "All Reviews"}</h3>
              <div className="space-y-2">
                {feedback.map((f, idx) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card className={f.rating <= 2 ? "border-red-200 dark:border-red-900/50" : f.rating >= 4 ? "border-green-200 dark:border-green-900/50" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`size-10 rounded-full flex items-center justify-center text-lg shrink-0 ${
                            f.rating >= 4 ? "bg-green-100 dark:bg-green-950" : f.rating === 3 ? "bg-amber-100 dark:bg-amber-950" : "bg-red-100 dark:bg-red-950"
                          }`}>
                            {f.rating >= 4 ? "😊" : f.rating === 3 ? "😐" : "😞"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{f.name}</span>
                                {f.email && <span className="text-[11px] text-muted-foreground truncate">{f.email}</span>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <Star key={n} className={`size-3 ${n <= f.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{f.comment}</p>
                            <p className="text-[11px] text-muted-foreground mt-2">{fmtDate(f.createdAt)} · {fmtRelative(f.createdAt)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
