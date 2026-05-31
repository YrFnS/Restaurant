'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChefHat, Plus, Monitor, CheckCircle2,
  UtensilsCrossed, Bike, Car, Users,
} from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { OrderTicketCard } from './KitchenOrderCard';

// ============ TYPES ============
interface OrderItemData {
  id: string;
  menuItemId: string;
  menuItemName: string;
  menuItemNameAr: string;
  quantity: number;
  unitPrice: number;
  modifiers: string;
  notes: string | null;
  totalPrice: number;
  status: string;
  station: string;
  hold: boolean;
  seatNumber: number | null;
}

interface OrderData {
  id: string;
  orderNumber: string;
  type: string;
  status: string;
  customerName: string;
  notes: string | null;
  tableNumber: number | null;
  createdAt: string;
  items: OrderItemData[];
}

// ============ COMPLETED ORDER CARD ============
function CompletedOrderCard({ order }: { order: OrderData }) {
  const { t } = useI18n();
  const orderTypeInfo = getOrderTypeIcon(order.type, { takeout: t.staff.takeout, delivery: t.staff.delivery, driveThru: t.staff.driveThru, dineIn: t.staff.dineIn });
  return (
    <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-500/20 rounded-xl px-3.5 py-2.5 flex items-center justify-between hover:shadow-lg hover:shadow-emerald-500/5 transition-all hover:border-emerald-500/30">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="size-4 text-emerald-500" />
        </div>
        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">#{order.orderNumber}</span>
        {order.tableNumber && <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">T{order.tableNumber}</Badge>}
        <span className={`text-[10px] font-medium ${orderTypeInfo.color}`}>{orderTypeInfo.label}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{order.items.length} {t.staff.items}</span>
    </div>
  );
}

function getOrderTypeIcon(type: string, labels?: { takeout: string; delivery: string; driveThru: string; dineIn: string }): { icon: React.ReactNode; label: string; color: string; bg: string } {
  const l = labels || { takeout: 'Takeout', delivery: 'Delivery', driveThru: 'Drive-Thru', dineIn: 'Dine-In' };
  switch (type) {
    case 'takeout': return { icon: <UtensilsCrossed className="size-3.5" />, label: l.takeout, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' };
    case 'delivery': return { icon: <Bike className="size-3.5" />, label: l.delivery, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' };
    case 'drive_thru': return { icon: <Car className="size-3.5" />, label: l.driveThru, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500/10' };
    default: return { icon: <Users className="size-3.5" />, label: l.dineIn, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-500/10' };
  }
}

// ============ ORDER QUEUE ============
export function KitchenOrderQueue({
  sortedOrders,
  activeStation,
  stationColor,
  onBump,
  onFire,
  onBumpAll,
  completedOrders,
}: {
  sortedOrders: OrderData[];
  activeStation: string;
  stationColor: string;
  onBump: (id: string) => void;
  onFire: (id: string) => void;
  onBumpAll: (order: OrderData) => void;
  completedOrders: OrderData[];
}) {
  const { t } = useI18n();

  return (
    <div className="p-2 sm:p-4">
      <AnimatePresence mode="popLayout">
        {sortedOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-muted-foreground"
          >
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="mb-6"
            >
              <div className="size-28 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-200/60 dark:border-amber-700/40 flex items-center justify-center shadow-xl shadow-amber-500/15">
                <ChefHat className="size-14 text-amber-500/60" />
              </div>
            </motion.div>
            <p className="text-xl font-bold text-foreground mb-2">{t.kitchen.noOrders}</p>
            <p className="text-sm text-muted-foreground max-w-xs text-center mb-6">{t.kitchen.noOrdersDesc}</p>
            <div className="flex items-center gap-3">
              <Link href="/pos">
                <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-md shadow-amber-500/25">
                  <Plus className="size-4 me-1.5" />{t.kitchen.createOrder}
                </Button>
              </Link>
              <Link href="/kitchen/all-stations">
                <Button variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 font-semibold">
                  <Monitor className="size-4 me-1.5" />{t.kitchen.kdsScreens}
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedOrders.map((order, idx) => (
              <OrderTicketCard key={order.id} order={order} stationSlug={activeStation} stationColor={stationColor} onBump={onBump} onFire={onFire} onBumpAll={onBumpAll} orderIndex={idx} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Recently completed */}
      {completedOrders.length > 0 && (
        <div className="mt-6 sm:mt-8">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="size-4 text-white" />
            </div>
            <h2 className="text-base font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">{t.staff.recentlyCompleted}</h2>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">{completedOrders.length}</Badge>
            <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/20 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {completedOrders.map((order, idx) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <CompletedOrderCard order={order} />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
