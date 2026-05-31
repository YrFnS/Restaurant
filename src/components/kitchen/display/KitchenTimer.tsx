'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

function getElapsedSeconds(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
}

function getUrgencyLevel(seconds: number): 'fresh' | 'normal' | 'warning' | 'urgent' | 'critical' {
  const minutes = seconds / 60;
  if (minutes < 5) return 'fresh';
  if (minutes < 10) return 'normal';
  if (minutes < 15) return 'warning';
  if (minutes < 20) return 'urgent';
  return 'critical';
}

function getUrgencyColors(level: ReturnType<typeof getUrgencyLevel>) {
  switch (level) {
    case 'fresh': return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', ring: '#10b981', light: 'bg-emerald-500/10' };
    case 'normal': return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', ring: '#f59e0b', light: 'bg-amber-500/10' };
    case 'warning': return { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', ring: '#f97316', light: 'bg-orange-500/10' };
    case 'urgent': return { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', ring: '#ef4444', light: 'bg-red-500/10' };
    case 'critical': return { bg: 'bg-red-600', text: 'text-red-700 dark:text-red-400', ring: '#dc2626', light: 'bg-red-600/10' };
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatRelativeTime(createdAt: string, t?: { justNow: string; ago: string }): string {
  const seconds = getElapsedSeconds(createdAt);
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return t?.justNow || 'Just now';
  if (minutes < 60) return `${minutes}m ${t?.ago || 'ago'}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function ElapsedTimer({ createdAt, compact = false }: { createdAt: string; compact?: boolean }) {
  const { t } = useI18n();
  const [seconds, setSeconds] = useState(getElapsedSeconds(createdAt));
  useEffect(() => {
    const interval = setInterval(() => setSeconds(getElapsedSeconds(createdAt)), 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const level = getUrgencyLevel(seconds);
  const colors = getUrgencyColors(level);
  const maxSeconds = 30 * 60;
  const progress = Math.min(seconds / maxSeconds, 1);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${colors.bg} ${level === 'critical' || level === 'urgent' ? 'animate-pulse' : ''}`} />
        <span className={`font-mono text-sm font-bold tabular-nums ${colors.text}`}>
          {formatElapsed(seconds)}
        </span>
        <span className="text-[11px] text-muted-foreground">{formatRelativeTime(createdAt, { justNow: t.staff.justNow, ago: t.kitchen.ago })}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${colors.bg} ${level === 'critical' || level === 'urgent' ? 'animate-pulse' : ''}`} />
        <span className={`font-mono text-base font-black tabular-nums ${colors.text}`}>
          {formatElapsed(seconds)}
        </span>
      </div>
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden hidden sm:block">
        <div className={`h-full rounded-full transition-all duration-1000 ${colors.bg}`} style={{ width: `${progress * 100}%` }} />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(createdAt, { justNow: t.staff.justNow, ago: t.kitchen.ago })}</span>
    </div>
  );
}
