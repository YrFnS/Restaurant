"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Star, Flame, Sparkles, Utensils, Search,
  TrendingUp, Award, Eye,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

export default function AdminFeaturedPage() {
  const { t, isRTL, fmtCurrency } = useI18n();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["menu-all"],
    queryFn: async () => (await fetch("/api/menu?all=true")).json(),
  });
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState("all");
  const [flagFilter, setFlagFilter] = useState<"all" | "special" | "popular" | "new">("all");

  const categories: any[] = data?.categories || [];
  const allItems = categories.flatMap((c) => c.items.map((i: any) => ({ ...i, categoryName: isRTL ? c.nameAr : c.nameEn })));
  const filtered = allItems.filter((i) => {
    if (activeCat !== "all" && i.categoryId !== activeCat) return false;
    if (flagFilter === "special" && !i.isSpecial) return false;
    if (flagFilter === "popular" && !i.isPopular) return false;
    if (flagFilter === "new" && !i.isNew) return false;
    if (query) return i.nameEn.toLowerCase().includes(query.toLowerCase()) || i.nameAr.includes(query);
    return true;
  });

  const toggleFlag = async (item: any, flag: "isSpecial" | "isPopular" | "isNew") => {
    setUpdating(item.id);
    try {
      const r = await fetch(`/api/menu/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: !item[flag] }),
      });
      if (r.ok) {
        qc.invalidateQueries({ queryKey: ["menu-all"] });
        qc.invalidateQueries({ queryKey: ["menu"] });
        toast.success(
          `${isRTL ? item.nameAr : item.nameEn} — ${flag === "isSpecial" ? (item[flag] ? "removed from specials" : "marked as special") : flag === "isPopular" ? (item[flag] ? "removed from popular" : "marked as popular") : (item[flag] ? "removed from new" : "marked as new")}`
        );
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setUpdating(null);
    }
  };

  const specialCount = allItems.filter((i) => i.isSpecial).length;
  const popularCount = allItems.filter((i) => i.isPopular).length;
  const newCount = allItems.filter((i) => i.isNew).length;

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon"><Arrow className="size-5" /></Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Award className="size-5 text-primary" />
                {isRTL ? "إدارة المميز" : "Featured Items"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "تحكم في الأصناف المميزة والرائجة والجديدة" : "Manage specials, popular, and new items"}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/0">
                <CardContent className="p-4 text-center">
                  <Sparkles className="size-5 text-primary mx-auto mb-1" />
                  <div className="text-2xl font-bold text-primary">{specialCount}</div>
                  <div className="text-[10px] text-muted-foreground">{isRTL ? "مميز" : "Specials"}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                <CardContent className="p-4 text-center">
                  <Flame className="size-5 text-amber-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-amber-600">{popularCount}</div>
                  <div className="text-[10px] text-muted-foreground">{isRTL ? "رائج" : "Popular"}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/0">
                <CardContent className="p-4 text-center">
                  <Star className="size-5 text-green-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-green-600">{newCount}</div>
                  <div className="text-[10px] text-muted-foreground">{isRTL ? "جديد" : "New"}</div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.menu.search}
                className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Flag filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {([
                { id: "all", label: isRTL ? "الكل" : "All" },
                { id: "special", label: isRTL ? "مميز" : "Specials", icon: Sparkles },
                { id: "popular", label: isRTL ? "رائج" : "Popular", icon: Flame },
                { id: "new", label: isRTL ? "جديد" : "New", icon: Star },
              ] as const).map((f) => {
                const Icon = (f as any).icon;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFlagFilter(f.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      flagFilter === f.id ? "bg-primary text-primary-foreground" : "bg-accent hover:bg-accent/70"
                    }`}
                  >
                    {Icon && <Icon className="size-3" />}
                    {f.label}
                  </button>
                );
              })}
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveCat("all")}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  activeCat === "all" ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {isRTL ? "كل الفئات" : "All Categories"}
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    activeCat === c.id ? "bg-muted text-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  <span>{c.icon}</span>
                  {isRTL ? c.nameAr : c.nameEn}
                </button>
              ))}
            </div>

            {/* Items list with toggle switches */}
            <div className="space-y-2">
              {filtered.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                >
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {/* Image */}
                        <div className="size-12 rounded-lg overflow-hidden bg-accent shrink-0">
                          {item.image ? (
                            <img src={item.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm truncate">{isRTL ? item.nameAr : item.nameEn}</h3>
                            <span className="text-xs text-muted-foreground shrink-0">{fmtCurrency(item.price)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {isRTL ? item.category?.nameAr : item.category?.nameEn}
                          </p>
                        </div>
                        {/* Toggle switches */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={item.isSpecial}
                              onCheckedChange={() => toggleFlag(item, "isSpecial")}
                              disabled={updating === item.id}
                            />
                            <span className="text-[9px] text-muted-foreground font-medium">{isRTL ? "مميز" : "Special"}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={item.isPopular}
                              onCheckedChange={() => toggleFlag(item, "isPopular")}
                              disabled={updating === item.id}
                            />
                            <span className="text-[9px] text-muted-foreground font-medium">{isRTL ? "رائج" : "Popular"}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={item.isNew}
                              onCheckedChange={() => toggleFlag(item, "isNew")}
                              disabled={updating === item.id}
                            />
                            <span className="text-[9px] text-muted-foreground font-medium">{isRTL ? "جديد" : "New"}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <Card><CardContent className="p-8 text-center text-muted-foreground">{t.menu.noResults}</CardContent></Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
