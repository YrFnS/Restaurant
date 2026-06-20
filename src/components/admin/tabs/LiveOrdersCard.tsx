"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../shared";
import {
  Bell, BellOff, Volume2, Clock, ChefHat, Package, CheckCircle2,
  XCircle, ShoppingBag, Flame, ArrowRight, ArrowLeft,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const statusMeta: Record<string, { color: string; bg: string; icon: any }> = {
  pending: { color: "text-zinc-600", bg: "bg-zinc-100 dark:bg-zinc-800", icon: Clock },
  confirmed: { color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950", icon: CheckCircle2 },
  preparing: { color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-950", icon: ChefHat },
  ready: { color: "text-green-600", bg: "bg-green-100 dark:bg-green-950", icon: Package },
  completed: { color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950", icon: CheckCircle2 },
  cancelled: { color: "text-red-600", bg: "bg-red-100 dark:bg-red-950", icon: XCircle },
};

export function LiveOrdersCard() {
  const { t, isRTL, fmtCurrency, fmtRelative } = useI18n();
  const [soundOn, setSoundOn] = useState(true);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  const { data } = useQuery({
    queryKey: ["live-orders"],
    queryFn: async () => {
      const r = await fetch("/api/orders?limit=10");
      return r.json();
    },
    refetchInterval: 4000,
  });

  const orders: any[] = data?.orders || [];
  const activeOrders = orders.filter((o) => ["confirmed", "preparing", "ready"].includes(o.status));

  const playNewOrderBeep = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      [880, 1320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.18);
      });
    } catch {}
  }, []);

  // Detect new orders and play sound
  useEffect(() => {
    if (orders.length === 0) return;
    const currentIds = new Set(orders.map((o) => o.id));
    if (seenIdsRef.current.size === 0) {
      // first load — seed without sound
      seenIdsRef.current = currentIds;
      return;
    }
    const fresh = orders.filter((o) => !seenIdsRef.current.has(o.id));
    if (fresh.length > 0) {
      const freshIds = fresh.map((o) => o.id);
      setNewIds((prev) => {
        const combined = new Set(prev);
        freshIds.forEach((id) => combined.add(id));
        return combined;
      });
      // remove from "new" after 8s
      freshIds.forEach((id) => {
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 8000);
      });
      if (soundOn) {
        playNewOrderBeep();
        toast.success(`${isRTL ? "طلب جديد" : "New order"} ${fresh[0].orderNumber}`, {
          description: `${fresh[0].items?.length || 0} ${isRTL ? "صنف" : "items"} · ${fmtCurrency(fresh[0].total)}`,
        });
      }
    }
    seenIdsRef.current = currentIds;
  }, [orders, soundOn, isRTL, fmtCurrency, playNewOrderBeep, newIds]);

  return (
    <Card className="lg:col-span-2 border-border/60 overflow-hidden">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="relative flex">
            <span className="size-2.5 rounded-full bg-green-500" />
            <span className="absolute inset-0 size-2.5 rounded-full bg-green-500 animate-ping" />
          </span>
          {isRTL ? "الطلبات المباشرة" : "Live Orders"}
          <Badge variant="secondary" className="text-[10px]">{activeOrders.length}</Badge>
        </CardTitle>
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
          aria-label="Toggle sound"
        >
          {soundOn ? <Volume2 className="size-4 text-primary" /> : <BellOff className="size-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      <CardContent>
        {activeOrders.length === 0 ? (
          <EmptyState icon={<ShoppingBag className="size-5" />} title={isRTL ? "لا طلبات نشطة" : "No active orders"} />
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto scroll-thin pe-1">
            <AnimatePresence initial={false}>
              {activeOrders.map((order) => {
                const meta = statusMeta[order.status] || statusMeta.confirmed;
                const Icon = meta.icon;
                const isNew = newIds.has(order.id);
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={isNew ? { opacity: 0, x: -20, backgroundColor: "rgba(245,158,11,0.15)" } : false}
                    animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }}
                    transition={{ duration: 0.4 }}
                  >
                    <Link href="/admin" className="block">
                      <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${isNew ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent/40"} transition-colors`}>
                        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${meta.bg}`}>
                          <Icon className={`size-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{order.orderNumber}</span>
                            {order.table && <span className="text-xs text-muted-foreground">· {isRTL ? "طاولة" : "Table"} {order.table.number}</span>}
                            {isNew && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground"
                              >
                                {isRTL ? "جديد" : "NEW"}
                              </motion.span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {order.items?.length || 0} {isRTL ? "صنف" : "items"} · {fmtRelative(order.createdAt)}
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <div className="font-bold text-sm text-primary">{fmtCurrency(order.total)}</div>
                          <div className={`text-[10px] font-medium ${meta.color}`}>
                            {(t.orders as any)[order.status] || order.status}
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
        <Link href="/admin" className="block mt-3">
          <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs">
            {isRTL ? "كل الطلبات" : "View all orders"}
            <Arrow className="size-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
