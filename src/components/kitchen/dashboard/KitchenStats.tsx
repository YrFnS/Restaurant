'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Monitor, ArrowRight, Plus, Activity,
  Settings2, BarChart3, Clock, Check,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n';

// ============ TYPES ============
interface KitchenScreenData {
  id: string;
  name: string;
  slug: string;
  description: string;
  stationFilter: string;
  layoutType: string;
  autoRefreshInterval: number;
  showCompleted: boolean;
  maxOrders: number;
  sortOrder: number;
  isActive: boolean;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ============ STATS BAR ============
export function KitchenStatsBar({
  stats,
  lastUpdated,
  stationColor,
  allDaySummary,
}: {
  stats: { totalActive: number; avgWait: number; completedItems: number; totalItems: number; priorityCount: number };
  lastUpdated: Date;
  stationColor: string;
  allDaySummary: [string, number][];
}) {
  const { t } = useI18n();

  return (
    <>
      {/* ALL DAY Summary Bar */}
      {allDaySummary.length > 0 && (
        <div className="px-3 sm:px-4 py-1.5 bg-muted/30 border-t border-border">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold whitespace-nowrap flex items-center gap-1">
              <BarChart3 className="size-3" /> {t.staff.allDay}:
            </span>
            {allDaySummary.map(([name, count]) => (
              <Badge key={name} className="text-[10px] font-bold whitespace-nowrap px-2 py-0 border-0"
                style={{ backgroundColor: `${stationColor}15`, color: stationColor }}>
                {name} ×{count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Stats Bar - Amber gradient with live active count */}
      <div className="px-3 sm:px-4 py-1.5 bg-gradient-to-r from-amber-500/90 to-orange-500/90 dark:from-amber-600/90 dark:to-orange-600/90">
        <div className="flex items-center gap-2 text-[11px] text-white/90 flex-wrap">
          <span className="flex items-center gap-1.5 bg-white/15 px-2.5 py-0.5 rounded-md backdrop-blur-sm"><Activity className="size-3" /><strong className="text-white">{stats.totalActive}</strong> {t.kitchen.activeOrders}</span>
          {allDaySummary.length > 0 && allDaySummary.slice(0, 4).map(([name, count]) => (
            <Badge key={name} className="text-[10px] font-bold whitespace-nowrap px-2 py-0 border-0 bg-white/15 text-white backdrop-blur-sm">
              {name} ×{count}
            </Badge>
          ))}
          <span className="ms-auto text-[10px] text-white/60">{t.kitchen.lastUpdated} {lastUpdated.toLocaleTimeString()}</span>
        </div>
      </div>
    </>
  );
}

// ============ QUICK ACTIONS ============
export function KitchenQuickActions() {
  const { t } = useI18n();
  return (
    <div className="mt-6 sm:mt-8 mb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20">
          <Zap className="size-4 text-white" />
        </div>
        <h2 className="text-base font-bold text-foreground tracking-tight">{t.kitchen.quickActions}</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Link href="/pos">
          <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
            <div className="flex flex-col items-center gap-2.5 p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
              <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Plus className="size-5 text-amber-600 dark:text-amber-400" /></div>
              <span className="text-xs font-semibold text-foreground text-center">{t.kitchen.createOrder}</span>
            </div>
          </motion.div>
        </Link>
        <Link href="/admin">
          <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
            <div className="flex flex-col items-center gap-2.5 p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
              <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Settings2 className="size-5 text-amber-600 dark:text-amber-400" /></div>
              <span className="text-xs font-semibold text-foreground text-center">{t.kitchen.manageMenu}</span>
            </div>
          </motion.div>
        </Link>
        <Link href="/kitchen/all-stations">
          <motion.div whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}>
            <div className="flex flex-col items-center gap-2.5 p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all cursor-pointer">
              <div className="size-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center"><Monitor className="size-5 text-amber-600 dark:text-amber-400" /></div>
              <span className="text-xs font-semibold text-foreground text-center">{t.kitchen.kdsScreens}</span>
            </div>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}

// ============ KDS SCREENS SECTION ============
export function KitchenKdsScreens({
  kdsScreens,
  stats,
  isRTL,
}: {
  kdsScreens: KitchenScreenData[];
  stats: { totalActive: number; avgWait: number; completedItems: number; totalItems: number; priorityCount: number };
  isRTL: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2 sm:mt-4">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex items-center justify-center size-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md shadow-amber-500/20">
          <Monitor className="size-4 text-white" />
        </div>
        <h2 className="text-base font-bold text-foreground tracking-tight">{t.kitchen.kdsScreens}</h2>
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px]">{kdsScreens.length}</Badge>
        <div className="flex-1 h-px bg-gradient-to-r from-amber-500/20 to-transparent" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {/* All Stations card */}
        <Link href="/kitchen/all-stations">
          <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
            <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all cursor-pointer rounded-xl shadow-sm h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      <Zap className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <span className="font-bold text-foreground text-sm">{t.kitchen.allStationsScreen}</span>
                  </div>
                  <ArrowRight className={`size-4 text-amber-600 dark:text-amber-400 ${isRTL ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-xs text-muted-foreground">{t.kitchen.allStations}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0 text-[10px]">{stats.totalActive} {t.kitchen.activeOrders}</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </Link>

        {/* KDS screen cards */}
        {kdsScreens.map((screen, index) => (
          <motion.div
            key={screen.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
          >
            <Link href={`/kitchen/${screen.slug}`}>
              <Card className={`bg-card border-border hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5 transition-all cursor-pointer rounded-xl shadow-sm group h-full ${!screen.isActive ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-muted/60 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                        <Monitor className="size-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-sm truncate">{screen.name}</h3>
                        {screen.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{screen.description}</p>}
                      </div>
                    </div>
                    <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${screen.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                      {screen.isActive ? t.kitchen.screenActive : t.kitchen.screenInactive}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{screen.stationFilter || t.kitchen.allStations}</span>
                    <span>·</span>
                    <span>{screen.autoRefreshInterval}{t.kitchen.screenSeconds}</span>
                    {screen.maxOrders > 0 && (
                      <>
                        <span>·</span>
                        <span>{t.kitchen.maxOrders}: {screen.maxOrders}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-mono">/kitchen/{screen.slug}</span>
                    <ArrowRight className={`size-3 text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity ${isRTL ? 'rotate-180' : ''}`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}

        {/* Create New Screen card */}
        <Link href="/admin" className="block">
          <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
            <Card className="bg-card border-dashed border-2 border-muted hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all cursor-pointer rounded-xl shadow-sm h-full">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[120px]">
                <div className="w-11 h-11 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl flex items-center justify-center mb-2">
                  <Plus className="size-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="font-bold text-foreground text-sm">{t.kitchen.createScreenAdmin}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{t.kitchen.createScreenAdminDesc}</span>
              </CardContent>
            </Card>
          </motion.div>
        </Link>
      </div>
    </div>
  );
}
