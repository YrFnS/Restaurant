"use client";

import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Users, Timer, DollarSign,
  LogIn, LogOut, UserCheck,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";

const roleColors: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  manager: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  server: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  cook: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  bartender: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  host: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

export default function AdminTimesheetPage() {
  const { t, isRTL, fmtCurrency, fmtTime, fmtDate } = useI18n();
  const qc = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["clock-status"],
    queryFn: async () => (await fetch("/api/employees/clock")).json(),
    refetchInterval: 30000,
  });

  const employees: any[] = data?.employees || [];
  const clockedInCount = data?.clockedInCount || 0;
  const totalHoursToday = data?.totalHoursToday || 0;
  const totalLaborCost = employees.reduce((s, e) => s + (e.currentSessionHours || 0) * e.hourlyWage, 0);

  const toggleClock = async (employee: any) => {
    setActionLoading(employee.id);
    try {
      const action = employee.clockedIn ? "out" : "in";
      const r = await fetch("/api/employees/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: employee.id, action }),
      });
      if (r.ok) {
        toast.success(
          action === "in"
            ? `${employee.name} ${isRTL ? "سجّل الدخول" : "clocked in"}`
            : `${employee.name} ${isRTL ? "سجّل الخروج" : "clocked out"}`
        );
        refetch();
      }
    } catch {
      toast.error(t.common.error);
    } finally {
      setActionLoading(null);
    }
  };

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
                <Timer className="size-5 text-primary" />
                {isRTL ? "سجل الدوام" : "Staff Timesheet"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL ? "تتبع ساعات العمل وتكلفة العمالة" : "Track work hours and labor cost"}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <span className={`size-2 rounded-full ${clockedInCount > 0 ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`} />
            {clockedInCount} {isRTL ? "حاضر" : "clocked in"}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">{t.common.loading}</div>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="bg-gradient-to-br from-green-500/5 to-green-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "حاضرون الآن" : "Clocked In"}</span>
                    <UserCheck className="size-4 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold text-green-600">{clockedInCount}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{isRTL ? `من ${employees.length} موظف` : `of ${employees.length} staff`}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "ساعات اليوم" : "Hours Today"}</span>
                    <Timer className="size-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{totalHoursToday.toFixed(1)}h</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{isRTL ? "ساعات العمل الحالية" : "current session hours"}</div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-primary/5 to-primary/0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{isRTL ? "تكلفة العمالة" : "Labor Cost"}</span>
                    <DollarSign className="size-4 text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-primary">{fmtCurrency(totalLaborCost)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{isRTL ? "الجلسة الحالية" : "current session"}</div>
                </CardContent>
              </Card>
            </div>

            {/* Clocked-in staff highlighted */}
            {clockedInCount > 0 && (
              <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="p-4">
                  <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-green-700 dark:text-green-400">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full rounded-full bg-green-500 opacity-75 animate-ping" />
                      <span className="relative inline-flex size-2 rounded-full bg-green-500" />
                    </span>
                    {isRTL ? "الموظفون الحاضرون" : "Currently Clocked In"}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {employees.filter((e) => e.clockedIn).map((e) => (
                      <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-border">
                        <div className="size-9 rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 flex items-center justify-center font-bold text-sm shrink-0">
                          {e.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{e.name}</div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Timer className="size-3" />
                            {e.currentSessionHours.toFixed(1)}h {isRTL ? "حتى الآن" : "so far"}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
                          disabled={actionLoading === e.id}
                          onClick={() => toggleClock(e)}
                        >
                          <LogOut className="size-3" />
                          {isRTL ? "خروج" : "Out"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All staff list */}
            <div>
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Users className="size-4 text-primary" />
                {isRTL ? "كل الموظفين" : "All Staff"}
              </h3>
              <div className="space-y-2">
                {employees.map((e, idx) => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                  >
                    <Card className={e.clockedIn ? "border-green-200 dark:border-green-900/50" : ""}>
                      <CardContent className="p-3.5 flex items-center gap-3">
                        <div className={`size-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          e.clockedIn ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"
                        }`}>
                          {e.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{e.name}</span>
                            <Badge className={`text-[10px] ${roleColors[e.role] || "bg-muted text-muted-foreground"}`}>{e.role}</Badge>
                            {e.clockedIn ? (
                              <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 dark:text-green-400 dark:border-green-800 gap-1">
                                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                {isRTL ? "حاضر" : "Active"}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">{isRTL ? "غير حاضر" : "Off shift"}</Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <DollarSign className="size-3" />
                              {fmtCurrency(e.hourlyWage)}/hr
                            </span>
                            {e.clockedIn && e.lastClockIn && (
                              <span className="flex items-center gap-1">
                                <LogIn className="size-3" />
                                {isRTL ? "منذ" : "since"} {fmtTime(e.lastClockIn)}
                              </span>
                            )}
                            {!e.clockedIn && e.lastClockOut && (
                              <span className="flex items-center gap-1">
                                <LogOut className="size-3" />
                                {fmtTime(e.lastClockOut)}
                              </span>
                            )}
                            {e.clockedIn && (
                              <span className="font-semibold text-green-600">{e.currentSessionHours.toFixed(1)}h</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={e.clockedIn ? "outline" : "default"}
                          className={`h-9 gap-1.5 shrink-0 ${e.clockedIn ? "text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950" : ""}`}
                          disabled={actionLoading === e.id}
                          onClick={() => toggleClock(e)}
                        >
                          {e.clockedIn ? (
                            <><LogOut className="size-4" />{isRTL ? "خروج" : "Clock Out"}</>
                          ) : (
                            <><LogIn className="size-4" />{isRTL ? "دخول" : "Clock In"}</>
                          )}
                        </Button>
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
