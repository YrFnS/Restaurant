"use client";

import React from "react";
import {
  ArrowLeft, RefreshCw, Volume2, VolumeX, Maximize, Minimize,
  ArrowUpDown, Settings2, BarChart3, Clock, Check, Zap, Monitor, ChefHat,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";

function getStationIcon(iconName: string, size: string = "size-4"): React.ReactNode {
  const cls = size;
  const iconMap: Record<string, React.ReactNode> = {
    Flame: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
    ChefHat: <ChefHat className={cls} />,
    Snowflake: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3m16.364-6.364l-12.728 12.728m12.728 0L5.636 5.636m12.728 0v12.728H5.636" /></svg>,
    Wine: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M8 22h8M12 15v7M12 15a6 6 0 00-6-6c0-3 2-6 6-6s6 3 6 6a6 6 0 00-6 6z" /></svg>,
    Eye: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
    Activity: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
    UtensilsCrossed: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3z" /></svg>,
  };
  return iconMap[iconName] || <ChefHat className={cls} />;
}

interface StationHeaderProps {
  stationName: string;
  stationColor: string;
  stationIcon: string;
  isAllStations: boolean;
  activeItems: number;
  priorityCount: number;
  avgWait: number;
  completedItems: number;
  totalItems: number;
  allDaySummary: [string, number][];
  sortMode: "time" | "priority";
  soundEnabled: boolean;
  isFullscreen: boolean;
  showControls: boolean;
  onRefresh: () => void;
  onSortToggle: () => void;
  onSoundToggle: () => void;
  onFullscreenToggle: () => void;
  onShowControlsToggle: () => void;
  isRTL: boolean;
}

export function StationHeader({
  stationName, stationColor, stationIcon, isAllStations,
  activeItems, priorityCount, avgWait, completedItems, totalItems,
  allDaySummary, sortMode, soundEnabled, isFullscreen, showControls,
  onRefresh, onSortToggle, onSoundToggle, onFullscreenToggle, onShowControlsToggle,
  isRTL,
}: StationHeaderProps) {
  const { t } = useI18n();

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div className="sticky top-12 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="px-3 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/kitchen" className="flex-shrink-0 text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
              <ArrowLeft className="size-5" />
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stationColor}15` }}>
                <span style={{ color: stationColor }}>
                  {isAllStations ? <Monitor className="size-4" /> : getStationIcon(stationIcon, "size-4")}
                </span>
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">{stationName}</h1>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant="outline" className="text-[11px] font-bold" style={{ borderColor: `${stationColor}40`, color: stationColor }}>
                {activeItems}
              </Badge>
              {priorityCount > 0 && (
                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] px-1.5 font-bold animate-pulse">
                  !{priorityCount}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={onRefresh}>
              <RefreshCw className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground sm:hidden" onClick={onShowControlsToggle}>
              <Settings2 className="size-4" />
            </Button>
            <div className="hidden sm:flex items-center gap-0.5">
              <Button variant={sortMode === "priority" ? "default" : "ghost"} size="sm"
                className={`h-8 px-2 text-xs gap-1 ${sortMode === "priority" ? "bg-red-600 hover:bg-red-500 text-white" : "text-muted-foreground"}`}
                onClick={onSortToggle}>
                <ArrowUpDown className="size-3" />{sortMode === "priority" ? t.staff.sortPriority : t.staff.sortTime}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={onSoundToggle}>
                {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={onFullscreenToggle}>
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showControls && (
        <div className="sm:hidden px-3 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant={sortMode === "priority" ? "default" : "ghost"} size="sm"
              className={`h-8 px-3 text-xs gap-1 ${sortMode === "priority" ? "bg-red-600 hover:bg-red-500 text-white" : "text-muted-foreground"}`}
              onClick={onSortToggle}>
              <ArrowUpDown className="size-3" />{sortMode === "priority" ? t.staff.priority : t.staff.sortTime}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground" onClick={onSoundToggle}>
              {soundEnabled ? <Volume2 className="size-4 me-1" /> : <VolumeX className="size-4 me-1" />}
              {soundEnabled ? t.staff.soundOn : t.staff.soundOff}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground" onClick={onFullscreenToggle}>
              {isFullscreen ? <Minimize className="size-4 me-1" /> : <Maximize className="size-4 me-1" />}
              {t.staff.fullscreen}
            </Button>
          </div>
        </div>
      )}

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

      <div className="px-3 sm:px-4 py-1.5 bg-muted/20 border-t border-border">
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Clock className="size-3" />{t.staff.avg} <strong className="text-foreground">{formatElapsed(avgWait)}</strong></span>
          <span className="flex items-center gap-1"><Check className="size-3 text-emerald-500" />{t.staff.done} <strong className="text-foreground">{completedItems}/{totalItems}</strong></span>
          {priorityCount > 0 && (
            <span className="text-red-600 dark:text-red-400 font-bold animate-pulse flex items-center gap-1"><Zap className="size-3" />{priorityCount} {t.staff.alert}</span>
          )}
        </div>
      </div>
    </div>
  );
}
