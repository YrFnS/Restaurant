'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Map, List, Users, Circle, Square } from 'lucide-react';
import { motion } from 'framer-motion';

// ============ STATUS COLOR MAP ============
const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string; dot: string }> = {
  open: {
    bg: 'fill-emerald-200 stroke-emerald-500',
    border: 'stroke-emerald-600',
    text: 'text-emerald-800',
    label: 'Available',
    dot: 'bg-emerald-500',
  },
  occupied: {
    bg: 'fill-red-200 stroke-red-500',
    border: 'stroke-red-600',
    text: 'text-red-800',
    label: 'Occupied',
    dot: 'bg-red-500',
  },
  reserved: {
    bg: 'fill-sky-200 stroke-sky-500',
    border: 'stroke-sky-600',
    text: 'text-sky-800',
    label: 'Reserved',
    dot: 'bg-sky-500',
  },
  cleaning: {
    bg: 'fill-gray-200 stroke-gray-400',
    border: 'stroke-gray-500',
    text: 'text-gray-600',
    label: 'Cleaning',
    dot: 'bg-gray-400',
  },
};

interface TableData {
  id: string;
  number: number;
  capacity: number;
  section: string;
  status: string;
  shape: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TableFloorPlanProps {
  tables: TableData[];
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
}

// ============ FLOOR PLAN VIEW ============
function FloorPlanView({ tables, selectedTableId, onSelectTable }: TableFloorPlanProps) {
  const sections = useMemo(() => {
    const sectionMap = new Map<string, TableData[]>();
    tables.forEach((t) => {
      const sec = t.section || 'main';
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(t);
    });
    return Array.from(sectionMap.entries());
  }, [tables]);

  const bounds = useMemo(() => {
    if (tables.length === 0) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    tables.forEach((t) => {
      minX = Math.min(minX, t.x);
      minY = Math.min(minY, t.y);
      maxX = Math.max(maxX, t.x + t.width);
      maxY = Math.max(maxY, t.y + t.height);
    });
    return {
      minX: Math.max(0, minX - 40),
      minY: Math.max(0, minY - 60),
      maxX: maxX + 40,
      maxY: maxY + 40,
    };
  }, [tables]);

  const planWidth = Math.max(800, bounds.maxX - bounds.minX + 80);
  const planHeight = Math.max(600, bounds.maxY - bounds.minY + 80);

  const sectionLabels: Record<string, string> = {
    main: 'Main Floor',
    patio: 'Patio',
    private: 'Private Room',
    bar: 'Bar',
  };

  return (
    <div className="relative w-full overflow-auto bg-muted/30 rounded-lg border">
      <svg
        width={planWidth}
        height={planHeight}
        className="block"
        style={{ minWidth: planWidth, minHeight: planHeight }}
      >
        <defs>
          <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/20" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="var(--background)" />
        <rect width="100%" height="100%" fill="url(#grid-pattern)" />

        {sections.map(([section, sectionTables]) => {
          let sMinX = Infinity, sMinY = Infinity;
          sectionTables.forEach((t) => {
            sMinX = Math.min(sMinX, t.x);
            sMinY = Math.min(sMinY, t.y);
          });
          return (
            <text key={section} x={sMinX} y={sMinY - 12} className="fill-muted-foreground text-xs font-semibold uppercase tracking-wider" fontSize="12">
              {sectionLabels[section] || section}
            </text>
          );
        })}

        {tables.map((table) => {
          const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.open;
          const isSelected = table.id === selectedTableId;
          const isRound = table.shape === 'round';

          return (
            <g key={table.id} className="cursor-pointer" onClick={() => onSelectTable(isSelected ? null : table.id)}>
              {isRound ? (
                <>
                  <ellipse cx={table.x + table.width / 2} cy={table.y + table.height / 2 + 2} rx={table.width / 2} ry={table.height / 2} className="fill-black/5" />
                  <ellipse cx={table.x + table.width / 2} cy={table.y + table.height / 2} rx={table.width / 2} ry={table.height / 2} className={`${config.bg} ${isSelected ? config.border : ''}`} strokeWidth={isSelected ? 3 : 1.5} />
                </>
              ) : (
                <>
                  <rect x={table.x + 2} y={table.y + 2} width={table.width} height={table.height} rx={6} className="fill-black/5" />
                  <rect x={table.x} y={table.y} width={table.width} height={table.height} rx={6} className={`${config.bg} ${isSelected ? config.border : ''}`} strokeWidth={isSelected ? 3 : 1.5} />
                </>
              )}
              <text x={table.x + table.width / 2} y={table.y + table.height / 2 - 4} textAnchor="middle" dominantBaseline="middle" className={`${config.text} font-bold`} fontSize="14">
                {table.number}
              </text>
              <text x={table.x + table.width / 2} y={table.y + table.height / 2 + 10} textAnchor="middle" dominantBaseline="middle" className={`${config.text} opacity-70`} fontSize="9">
                {table.capacity} seats
              </text>
              {isSelected && (
                <>
                  {isRound ? (
                    <ellipse cx={table.x + table.width / 2} cy={table.y + table.height / 2} rx={table.width / 2 + 5} ry={table.height / 2 + 5} fill="none" className="stroke-emerald-500" strokeWidth={2} strokeDasharray="6 3">
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${table.x + table.width / 2} ${table.y + table.height / 2}`} to={`360 ${table.x + table.width / 2} ${table.y + table.height / 2}`} dur="20s" repeatCount="indefinite" />
                    </ellipse>
                  ) : (
                    <rect x={table.x - 5} y={table.y - 5} width={table.width + 10} height={table.height + 10} rx={9} fill="none" className="stroke-emerald-500" strokeWidth={2} strokeDasharray="6 3">
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${table.x + table.width / 2} ${table.y + table.height / 2}`} to={`360 ${table.x + table.width / 2} ${table.y + table.height / 2}`} dur="20s" repeatCount="indefinite" />
                    </rect>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ============ LIST VIEW ============
function ListView({ tables, selectedTableId, onSelectTable }: TableFloorPlanProps) {
  const sections = useMemo(() => {
    const sectionMap = new Map<string, TableData[]>();
    tables.forEach((t) => {
      const sec = t.section || 'main';
      if (!sectionMap.has(sec)) sectionMap.set(sec, []);
      sectionMap.get(sec)!.push(t);
    });
    return Array.from(sectionMap.entries());
  }, [tables]);

  const sectionLabels: Record<string, string> = {
    main: 'Main Floor',
    patio: 'Patio',
    private: 'Private Room',
    bar: 'Bar',
  };

  return (
    <div className="space-y-4">
      {sections.map(([section, sectionTables]) => (
        <div key={section}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {sectionLabels[section] || section}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {sectionTables.map((table) => {
              const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.open;
              const isSelected = table.id === selectedTableId;

              return (
                <motion.button
                  key={table.id}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelectTable(isSelected ? null : table.id)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-h-[80px] ${
                    isSelected ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 shadow-md' : 'border-transparent bg-card hover:border-border hover:shadow-sm'
                  }`}
                >
                  <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${config.dot}`} />
                  {table.shape === 'round' ? (
                    <Circle className={`h-6 w-6 ${config.text} opacity-60`} />
                  ) : (
                    <Square className={`h-6 w-6 ${config.text} opacity-60`} />
                  )}
                  <span className={`font-bold text-sm ${config.text}`}>T{table.number}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <Users className="h-3 w-3" />
                    {table.capacity}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {config.label}
                  </Badge>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ LEGEND ============
function FloorPlanLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 py-2 text-xs">
      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-full ${config.dot}`} />
          <span className="text-muted-foreground">{config.label}</span>
        </div>
      ))}
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function TableFloorPlan({ tables, selectedTableId, onSelectTable }: TableFloorPlanProps) {
  const [viewMode, setViewMode] = useState<'floor' | 'list'>('floor');

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    tables.forEach((t) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return counts;
  }, [tables]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 space-y-2 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm">Tables</h3>
            <Badge variant="outline" className="text-xs">
              {tables.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'floor' ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-2 text-xs gap-1 ${viewMode === 'floor' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setViewMode('floor')}
            >
              <Map className="h-3 w-3" />
              Floor
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className={`h-7 px-2 text-xs gap-1 ${viewMode === 'list' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="h-3 w-3" />
              List
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = statusCounts[status] || 0;
            if (count === 0) return null;
            return (
              <div key={status} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-muted/50">
                <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                <span className="text-muted-foreground">{config.label}:</span>
                <span className="font-semibold">{count}</span>
              </div>
            );
          })}
        </div>

        <FloorPlanLegend />
      </div>

      <Separator />

      <div className="flex-1 min-h-0 mt-3">
        {viewMode === 'floor' ? (
          <ScrollArea className="h-full">
            <FloorPlanView tables={tables} selectedTableId={selectedTableId} onSelectTable={onSelectTable} />
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full">
            <ListView tables={tables} selectedTableId={selectedTableId} onSelectTable={onSelectTable} />
          </ScrollArea>
        )}
      </div>

      {selectedTableId && (
        <div className="shrink-0 mt-3 pt-3 border-t">
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-600" />
              <div>
                <div className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">
                  Table {tables.find((t) => t.id === selectedTableId)?.number}
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400">
                  {tables.find((t) => t.id === selectedTableId)?.capacity} seats
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/50" onClick={() => onSelectTable(null)}>
              Deselect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
