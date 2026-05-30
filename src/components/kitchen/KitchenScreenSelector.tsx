'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Monitor, Flame, ChefHat, Activity, Clock,
  RefreshCw, ArrowRight, Zap, Plus,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { ThemeToggle } from '@/components/staff/ThemeToggle';
import { LanguageToggle } from '@/components/staff/LanguageToggle';
import Link from 'next/link';

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

const STATION_ICONS: Record<string, React.ReactNode> = {
  Grill: <Flame className="size-4" />,
  Prep: <ChefHat className="size-4" />,
  Bar: <Activity className="size-4" />,
};

export default function KitchenScreenSelector() {
  const { t, locale, isRTL } = useI18n();

  const getStationName = (name: string) => {
    if (locale !== 'ar') return name;
    const map: Record<string, string> = {
      'Grill Station': 'محطة الشوي',
      'Prep Station': 'محطة التحضير',
      'Bar Station': 'محطة البار',
      'All Stations': 'جميع المحطات',
      'Grill': 'الشوي',
      'Prep': 'التحضير',
      'Bar': 'البار',
    };
    return map[name] || name;
  };

  const [screens, setScreens] = useState<KitchenScreenData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScreens = async () => {
      try {
        const res = await fetch('/api/kitchen-screens');
        if (res.ok) {
          const data = await res.json();
          setScreens(data.screens || []);
        }
      } catch (e) {
        console.error('Failed to fetch kitchen screens:', e);
      }
      setLoading(false);
    };
    fetchScreens();
  }, []);

  const getStationIcon = (station: string) => {
    if (!station) return <Monitor className="size-4" />;
    return STATION_ICONS[station] || <Monitor className="size-4" />;
  };

  const getStationLabel = (station: string) => {
    if (!station) return getStationName(t.kitchen.allStations);
    if (station === 'Grill') return getStationName(t.kitchen.grill);
    if (station === 'Prep') return getStationName(t.kitchen.prep);
    if (station === 'Bar') return getStationName(t.kitchen.bar);
    return getStationName(station);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
        <RefreshCw className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-amber-50/10 to-amber-50/20 dark:via-amber-950/5 dark:to-amber-950/10 text-foreground p-4 sm:p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header with gradient */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 dark:from-amber-700 dark:via-amber-600 dark:to-orange-600 rounded-2xl p-6 shadow-lg shadow-amber-500/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/10">
              <Monitor className="size-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{t.kitchen.selectScreen}</h1>
              <p className="text-sm text-white/80">{t.kitchen.selectScreenDesc}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Quick access to All Stations */}
        <Link href="/kitchen/all-stations">
          <motion.div
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.99 }}
            className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-5 flex items-center justify-between cursor-pointer hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-lg">
                <Zap className="size-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-lg">{t.kitchen.allStationsScreen}</h3>
                <p className="text-sm text-muted-foreground">{t.kitchen.allStations}</p>
              </div>
            </div>
            <ArrowRight className={`size-5 text-amber-600 dark:text-amber-400 ${isRTL ? 'rotate-180' : ''}`} />
          </motion.div>
        </Link>

        {/* Screens Grid */}
        {screens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <div className="size-28 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-200/60 dark:border-amber-700/40 flex items-center justify-center shadow-xl shadow-amber-500/15 mb-6">
              <Monitor className="size-14 text-amber-500/50" />
            </div>
            <p className="text-xl font-bold text-foreground">{t.kitchen.noScreens}</p>
            <p className="text-sm mt-1 mb-6 max-w-xs text-center">{t.kitchen.noScreensDesc}</p>
            <Link href="/admin">
              <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-md shadow-amber-500/25">
                <Plus className="size-4 me-1.5" />
                {t.kitchen.createScreenAdmin}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {screens.map((screen, index) => (
              <motion.div
                key={screen.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/kitchen/${screen.slug}`}>
                  <Card className={`bg-card border-border hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all duration-200 cursor-pointer group h-full rounded-xl shadow-sm ${!screen.isActive ? 'opacity-60' : ''}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-muted/50 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                            <Monitor className="size-4 text-muted-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-foreground text-base truncate">{screen.name}</h3>
                            {screen.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{screen.description}</p>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${screen.isActive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                          {screen.isActive ? t.kitchen.screenActive : t.kitchen.screenInactive}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{t.kitchen.screenStation}:</span>
                          <div className="flex items-center gap-1">
                            {getStationIcon(screen.stationFilter)}
                            <span className="text-foreground">{getStationLabel(screen.stationFilter)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="size-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{t.kitchen.screenRefresh}:</span>
                          <span className="text-foreground">{screen.autoRefreshInterval}{t.kitchen.screenSeconds}</span>
                        </div>

                        {screen.showCompleted && (
                          <div className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                              {t.kitchen.showCompleted}
                            </Badge>
                            {screen.maxOrders > 0 && (
                              <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                                {t.kitchen.maxOrders}: {screen.maxOrders}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-mono">/kitchen/{screen.slug}</span>
                        <Button size="sm" className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white text-xs h-8 px-3 font-semibold shadow-sm shadow-amber-500/20">
                          {t.kitchen.openScreen}
                          <ArrowRight className={`size-3.5 ms-1 ${isRTL ? 'rotate-180' : ''}`} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}

            {/* Create New Screen card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: screens.length * 0.05 }}
            >
              <Link href="/admin" className="block">
                <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card className="bg-card border-dashed border-2 border-muted hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all cursor-pointer rounded-xl shadow-sm h-full">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center min-h-[200px]">
                      <div className="w-14 h-14 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl flex items-center justify-center mb-3">
                        <Plus className="size-7 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="font-bold text-foreground text-base">{t.admin.createNewScreen}</span>
                      <span className="text-xs text-muted-foreground mt-1">{t.admin.createNewScreenDesc}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
