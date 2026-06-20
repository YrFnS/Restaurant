"use client";

import { useI18n } from "@/lib/i18n";
import { useRestaurantStore } from "@/lib/store";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Star, Clock, Truck, ChefHat, ArrowRight, ArrowLeft,
  Flame, Leaf, Award, Utensils, Calendar, Users, Sparkles, Quote, Send
} from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

export function HomeSection() {
  const { t, isRTL, fmtCurrency, fmtNumber } = useI18n();
  const { setActiveSection } = useRestaurantStore();

  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await fetch("/api/settings")).json(),
  });
  const { data: menuData } = useQuery({
    queryKey: ["menu"],
    queryFn: async () => (await fetch("/api/menu")).json(),
  });
  const { data: offersData } = useQuery({
    queryKey: ["offers"],
    queryFn: async () => (await fetch("/api/offers")).json(),
  });
  const { data: testimonialsData } = useQuery({
    queryKey: ["testimonials"],
    queryFn: async () => (await fetch("/api/testimonials")).json(),
  });
  const { data: dynamicData } = useQuery({
    queryKey: ["dynamic-pricing-active"],
    queryFn: async () => (await fetch("/api/dynamic-pricing?active=true")).json(),
    refetchInterval: 60000,
  });

  const s = settingsData?.settings;
  const categories = menuData?.categories || [];
  const popularItems = (categories.flatMap((c: any) => c.items) as any[]).filter((i) => i.isPopular).slice(0, 6);
  const specialItems = (categories.flatMap((c: any) => c.items) as any[]).filter((i) => i.isSpecial).slice(0, 3);
  const offers = offersData?.offers || [];
  const activeDeals = dynamicData?.rules || [];
  const testimonials = testimonialsData?.testimonials || [];

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  const isOpen = (() => {
    if (!s) return true;
    const h = now.getHours();
    const open = parseInt(s.openTime.split(":")[0]);
    const close = parseInt(s.closeTime.split(":")[0]);
    return h >= open && h < close;
  })();

  return (
    <div className="flex-1">
      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden min-h-[600px] md:min-h-[640px] flex items-center">
        {/* Background image */}
        {s?.heroImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${s.heroImageUrl})` }}
          />
        )}
        {/* Gradient overlays for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/30" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 50%, var(--primary) 0%, transparent 50%), radial-gradient(circle at 80% 20%, var(--primary) 0%, transparent 40%)`,
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 pt-10 md:pt-20 pb-12 md:pb-24 w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Badge variant={isOpen ? "default" : "secondary"} className="gap-1.5 px-3 py-1">
                <span className={`size-1.5 rounded-full ${isOpen ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                {isOpen ? t.home.openNow : t.home.closed}
              </Badge>
              <Badge variant="outline" className="gap-1.5 px-3 py-1">
                <Clock className="size-3" />
                {s?.openTime} - {s?.closeTime}
              </Badge>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-3 leading-[1.05]">
              <span className="bg-gradient-to-br from-primary via-primary to-amber-600 bg-clip-text text-transparent">
                {isRTL ? s?.nameAr : s?.nameEn}
              </span>
            </h1>
            <div className="flex items-center gap-2 mb-5">
              <div className="h-px w-12 bg-primary/60" />
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80">{t.app.tagline}</span>
            </div>
            <p className="text-base md:text-xl text-foreground/70 mb-8 leading-relaxed max-w-xl">
              {isRTL ? s?.descriptionAr : s?.descriptionEn}
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => setActiveSection("menu")} className="gap-2 text-base h-12 px-6">
                <Utensils className="size-5" />
                {t.home.orderNow}
                <Arrow className="size-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => setActiveSection("reservations")} className="gap-2 text-base h-12 px-6">
                <Calendar className="size-5" />
                {t.home.reserveTable}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setActiveSection("waitlist")} className="gap-2 text-base h-12 px-6">
                <Users className="size-5" />
                {t.home.joinWaitlist}
              </Button>
            </div>

            {/* Quick info row */}
            <div className="flex flex-wrap gap-6 mt-8 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="size-4 text-primary" />
                <span>{t.home.deliveryTime} {s?.avgPrepTimeMin} {t.common.minutes}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Leaf className="size-4 text-primary" />
                <span>{isRTL ? "خيارات نباتية" : "Vegetarian options"}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Flame className="size-4 text-primary" />
                <span>{isRTL ? "مشاوي طازجة" : "Fresh grills"}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── TODAY'S SPECIALS ─── */}
      {specialItems.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Sparkles className="size-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">{t.home.chefsRecommendation}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">{t.home.todaysSpecials}</h2>
            </div>
            <Button variant="ghost" onClick={() => setActiveSection("menu")} className="gap-1.5">
              {t.home.viewAll}
              <Arrow className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {specialItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="group overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 cursor-pointer h-full border-0 shadow-md" onClick={() => setActiveSection("menu")}>
                  <div className="relative h-52 overflow-hidden bg-gradient-to-br from-primary/20 to-accent">
                    {item.image ? (
                      <img src={item.image} alt={isRTL ? item.nameAr : item.nameEn} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-6xl opacity-40 group-hover:scale-110 transition-transform duration-500">🍽️</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge className="absolute top-3 start-3 gap-1 backdrop-blur-md bg-primary/90 text-primary-foreground border-0" variant="default">
                      <ChefHat className="size-3" />
                      {t.menu.special}
                    </Badge>
                    <div className="absolute bottom-3 start-3 end-3 text-primary-foreground">
                      <h3 className="font-bold text-lg mb-0.5 drop-shadow">{isRTL ? item.nameAr : item.nameEn}</h3>
                      <p className="text-xs line-clamp-1 opacity-90 drop-shadow">{isRTL ? item.descriptionAr : item.descriptionEn}</p>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-primary">{fmtCurrency(item.price)}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {item.preparationTime} {t.common.minutes}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ─── CATEGORIES ─── */}
      <section className="bg-accent/40 py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold mb-2">{t.home.exploreMenu}</h2>
            <p className="text-muted-foreground">{t.home.categories}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
            {categories.map((cat: any, idx: number) => (
              <motion.button
                key={cat.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => setActiveSection("menu")}
                className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-border"
              >
                <div
                  className="size-16 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  {cat.icon}
                </div>
                <span className="text-sm font-semibold text-center">{isRTL ? cat.nameAr : cat.nameEn}</span>
                <span className="text-[10px] text-muted-foreground">{cat.items.length} {t.menu.items}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── POPULAR ITEMS ─── */}
      {popularItems.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
          <div className="flex items-end justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Flame className="size-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">{t.menu.popular}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">{t.home.popularItems}</h2>
            </div>
            <Button variant="ghost" onClick={() => setActiveSection("menu")} className="gap-1.5">
              {t.home.viewAll}
              <Arrow className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularItems.map((item) => (
              <Card key={item.id} className="hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group hover:-translate-y-0.5" onClick={() => setActiveSection("menu")}>
                <CardContent className="p-4 flex gap-4 items-center">
                  <div className="size-24 rounded-xl overflow-hidden bg-gradient-to-br from-primary/20 to-accent shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={isRTL ? item.nameAr : item.nameEn} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold truncate">{isRTL ? item.nameAr : item.nameEn}</h3>
                      <span className="text-lg font-bold text-primary shrink-0">{fmtCurrency(item.price)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{isRTL ? item.descriptionAr : item.descriptionEn}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                      {item.dietary?.includes("spicy") && <span className="flex items-center gap-0.5"><Flame className="size-3 text-red-500" />{t.menu.spicy}</span>}
                      {item.dietary?.includes("vegetarian") && <span className="flex items-center gap-0.5"><Leaf className="size-3 text-green-500" />{t.menu.vegetarian}</span>}
                      <span className="flex items-center gap-0.5"><Clock className="size-3" />{item.preparationTime}{t.common.minutes}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ─── LIVE HAPPY HOUR BANNER ─── */}
      {activeDeals.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 md:px-6 pb-8">
          {activeDeals.map((deal: any) => {
            const discountPct = Math.round((1 - deal.multiplier) * 100);
            return (
              <motion.div
                key={deal.id}
                initial={{ opacity: 0, scale: 0.97 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 via-primary to-amber-600 text-white p-5 md:p-6 shadow-lg"
              >
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 40%)" }} />
                <div className="relative flex items-center gap-4">
                  <div className="size-14 md:size-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                    <span className="text-3xl md:text-4xl">⏰</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex size-full rounded-full bg-white opacity-75 animate-ping" />
                        <span className="relative inline-flex size-2 rounded-full bg-white" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-wider opacity-90">
                        {isRTL ? "عرض مباشر الآن" : "LIVE NOW"}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg md:text-xl leading-tight">{isRTL ? deal.nameAr : deal.nameEn}</h3>
                    <p className="text-xs md:text-sm opacity-90 mt-0.5">
                      {deal.startTime && deal.endTime ? `${deal.startTime} - ${deal.endTime} · ` : ""}
                      {discountPct}% {isRTL ? "خصم" : "off"}
                    </p>
                  </div>
                  <div className="text-center shrink-0">
                    <div className="text-3xl md:text-4xl font-bold tabular-nums">-{discountPct}%</div>
                    <Button
                      size="sm"
                      onClick={() => setActiveSection("menu")}
                      className="mt-1.5 bg-white text-primary hover:bg-white/90 h-8 text-xs"
                    >
                      {t.home.orderNow}
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </section>
      )}

      {/* ─── OFFERS BANNER ─── */}
      {offers.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 md:px-6 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {offers.map((offer: any) => (
              <div key={offer.id} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
                <div className="absolute -top-8 -end-8 size-32 rounded-full bg-white/10" />
                <div className="absolute -bottom-12 -start-4 size-24 rounded-full bg-white/5" />
                <div className="relative">
                  <Badge className="mb-3 bg-white/20 text-primary-foreground border-0">
                    {offer.discountPercent}% OFF
                  </Badge>
                  <h3 className="text-xl font-bold mb-1">{isRTL ? offer.titleAr : offer.titleEn}</h3>
                  <p className="text-sm text-primary-foreground/80">{isRTL ? offer.descriptionAr : offer.descriptionEn}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── STATS ─── */}
      <section className="bg-primary text-primary-foreground py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <h2 className="text-center text-2xl md:text-3xl font-bold mb-10">{t.home.statsTitle}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: <Utensils className="size-6" />, value: s?.statsOrdersServed || 0, label: t.home.statsOrders },
              { icon: <Sparkles className="size-6" />, value: categories.reduce((a: number, c: any) => a + c.items.length, 0), label: t.home.statsMenuItems },
              { icon: <Award className="size-6" />, value: s?.statsHappyCustomers || 0, label: t.home.statsHappyCustomers },
              { icon: <ChefHat className="size-6" />, value: s?.statsYearsService || 0, label: t.home.statsYears },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center size-12 rounded-xl bg-white/15 mb-3">
                  {stat.icon}
                </div>
                <div className="text-3xl md:text-4xl font-bold mb-1" dir="ltr">{fmtNumber(stat.value)}</div>
                <div className="text-sm text-primary-foreground/80">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <h2 className="text-center text-2xl md:text-3xl font-bold mb-10">{t.home.howItWorks}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            { n: "1", icon: <Utensils className="size-7" />, title: t.home.step1, desc: t.home.step1Desc },
            { n: "2", icon: <ChefHat className="size-7" />, title: t.home.step2, desc: t.home.step2Desc },
            { n: "3", icon: <Sparkles className="size-7" />, title: t.home.step3, desc: t.home.step3Desc },
          ].map((step, i) => (
            <div key={i} className="relative text-center">
              <div className="relative inline-flex items-center justify-center size-20 rounded-2xl bg-primary/10 text-primary mb-4">
                {step.icon}
                <span className="absolute -top-2 -end-2 size-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {step.n}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      {testimonials.length > 0 && (
        <section className="bg-accent/40 py-12 md:py-16">
          <div className="max-w-6xl mx-auto px-4 md:px-6">
            <div className="text-center mb-10">
              <Quote className="size-8 text-primary mx-auto mb-2" />
              <h2 className="text-2xl md:text-3xl font-bold">{t.home.testimonials}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {testimonials.map((tm: any, idx: number) => (
                <motion.div
                  key={tm.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Card className="h-full">
                    <CardContent className="p-5">
                      <div className="flex gap-0.5 mb-3">
                        {Array.from({ length: tm.stars }).map((_, i) => (
                          <Star key={i} className="size-4 fill-primary text-primary" />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground italic mb-4 leading-relaxed">
                        "{isRTL ? tm.commentAr : tm.commentEn}"
                      </p>
                      <div className="flex items-center gap-2.5">
                        <div className="size-10 rounded-full bg-accent flex items-center justify-center text-xl">
                          {tm.avatar || "👤"}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{isRTL ? tm.nameAr : tm.nameEn}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-green-500" />
                            {t.home.verifiedGuest}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── NEWSLETTER + FEEDBACK ─── */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NewsletterCard />
          <FeedbackCard />
        </div>
      </section>
    </div>
  );
}

function NewsletterCard() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const subscribe = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) {
        toast.success(t.home.subscribed);
        setEmail("");
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-accent/40 border-primary/20">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Send className="size-5 text-primary" />
          <h3 className="font-bold text-lg">{t.home.newsletter}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t.home.newsletterDesc}</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t.home.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-background"
          />
          <Button onClick={subscribe} disabled={loading}>
            {loading ? "..." : t.home.subscribe}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FeedbackCard() {
  const { t } = useI18n();
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!comment) return;
    setLoading(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name || "Guest", rating, comment }),
      });
      if (r.ok) {
        toast.success(t.home.messageSent);
        setName(""); setComment(""); setRating(5);
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <Quote className="size-5 text-primary" />
          <h3 className="font-bold text-lg">{t.home.feedback}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{t.home.feedbackDesc}</p>
        <div className="flex gap-1 mb-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
              <Star className={`size-7 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
            </button>
          ))}
        </div>
        <Input
          placeholder={t.contact.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-2"
        />
        <Textarea
          placeholder={t.home.feedbackDesc}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="mb-3 resize-none"
        />
        <Button onClick={submit} disabled={loading || !comment} className="w-full">
          {loading ? "..." : t.home.leaveFeedback}
        </Button>
      </CardContent>
    </Card>
  );
}
