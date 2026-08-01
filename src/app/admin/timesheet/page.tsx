"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  Coffee,
  DollarSign,
  History,
  LogIn,
  LogOut,
  PencilLine,
  Timer,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClockEmployee {
  id: string;
  name: string;
  role: string;
  hourlyWage: number;
  clockedIn: boolean;
  lastClockIn: string | null;
  lastClockOut: string | null;
  shiftId: string | null;
  shiftStartedAt: string | null;
  operationalDate: string | null;
  onBreak: boolean;
  breakStartedAt: string | null;
  elapsedSeconds: number;
  breakSeconds: number;
  paidSeconds: number;
  currentSessionHours: number;
  laborCost: number;
}

interface ShiftRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  status: "open" | "closed";
  operationalDate: string;
  startedAt: string;
  endedAt: string | null;
  grossHours: number;
  breakHours: number;
  paidHours: number;
  hourlyWage: number;
  laborCost: number;
  adjustmentSeconds: number;
  adjustmentCost: number;
  adjustmentCount: number;
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function idempotencyKey(prefix: string): string {
  return `${prefix}:${crypto.randomUUID()}`;
}

async function jsonFetch(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

const roleColors: Record<string, string> = {
  owner: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  admin: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  manager: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  server: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  cashier: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  cook: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  bartender: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  host: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

export default function AdminTimesheetPage() {
  const { t, isRTL, fmtCurrency, fmtTime, fmtDate } = useI18n();
  const queryClient = useQueryClient();
  const Arrow = isRTL ? ArrowRight : ArrowLeft;
  const today = new Date();
  const [from, setFrom] = useState(
    dateInput(new Date(today.getTime() - 13 * 24 * 60 * 60 * 1_000))
  );
  const [to, setTo] = useState(dateInput(today));
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adjustShift, setAdjustShift] = useState<ShiftRow | null>(null);

  const clockQuery = useQuery({
    queryKey: ["clock-status"],
    queryFn: () => jsonFetch("/api/employees/clock"),
    refetchInterval: 30_000,
  });
  const timesheetQuery = useQuery({
    queryKey: ["timekeeping", from, to],
    queryFn: () =>
      jsonFetch(
        `/api/timekeeping?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
  });

  const employees: ClockEmployee[] = clockQuery.data?.employees || [];
  const shifts: ShiftRow[] = timesheetQuery.data?.shifts || [];
  const liveSummary = clockQuery.data || {};
  const historySummary = timesheetQuery.data?.summary || {};

  const shiftByEmployee = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees]
  );

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["clock-status"] }),
      queryClient.invalidateQueries({ queryKey: ["timekeeping"] }),
    ]);
  };

  const recordAction = async (
    employee: ClockEmployee,
    action: "clock_in" | "clock_out" | "break_start" | "break_end"
  ) => {
    setActionLoading(`${employee.id}:${action}`);
    try {
      await jsonFetch("/api/employees/clock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey(`time-${action}`),
        },
        body: JSON.stringify({ employeeId: employee.id, action }),
      });
      const labels = {
        clock_in: isRTL ? "تم تسجيل الدخول" : "Clocked in",
        clock_out: isRTL ? "تم تسجيل الخروج" : "Clocked out",
        break_start: isRTL ? "بدأت الاستراحة" : "Break started",
        break_end: isRTL ? "انتهت الاستراحة" : "Break ended",
      };
      toast.success(`${employee.name}: ${labels[action]}`);
      await refreshAll();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? "rtl" : "ltr"}>
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin">
              <Button variant="ghost" size="icon" aria-label={isRTL ? "رجوع" : "Back"}>
                <Arrow className="size-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Timer className="size-5 text-primary" />
                {isRTL ? "سجل الدوام" : "Staff Timekeeping"}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                {isRTL
                  ? "سجل غير قابل للتعديل للدوام والاستراحات والتصحيحات"
                  : "Immutable shifts, breaks, labor cost, and audited corrections"}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <span
              className={`size-2 rounded-full ${
                (liveSummary.clockedInCount || 0) > 0
                  ? "bg-green-500 animate-pulse"
                  : "bg-muted-foreground"
              }`}
            />
            {liveSummary.clockedInCount || 0} {isRTL ? "حاضر" : "clocked in"}
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
          <Metric
            label={isRTL ? "حاضرون الآن" : "Clocked In"}
            value={String(liveSummary.clockedInCount || 0)}
            icon={<UserCheck className="size-4 text-green-600" />}
          />
          <Metric
            label={isRTL ? "في استراحة" : "On Break"}
            value={String(liveSummary.onBreakCount || 0)}
            icon={<Coffee className="size-4 text-amber-600" />}
          />
          <Metric
            label={isRTL ? "ساعات الجلسات" : "Live Paid Hours"}
            value={`${Number(liveSummary.currentPaidHours || 0).toFixed(1)}h`}
            icon={<Timer className="size-4 text-blue-600" />}
          />
          <Metric
            label={isRTL ? "تكلفة الجلسات" : "Live Labor Cost"}
            value={fmtCurrency(liveSummary.currentLaborCost || 0)}
            icon={<DollarSign className="size-4 text-primary" />}
          />
          <Metric
            label={isRTL ? "ساعات الفترة" : "Period Paid Hours"}
            value={`${Number(historySummary.paidHours || 0).toFixed(1)}h`}
            icon={<History className="size-4 text-violet-600" />}
          />
          <Metric
            label={isRTL ? "تكلفة الفترة" : "Period Labor Cost"}
            value={fmtCurrency(historySummary.laborCost || 0)}
            icon={<DollarSign className="size-4 text-emerald-600" />}
          />
        </div>

        <Card>
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="timesheet-from">{isRTL ? "من" : "From"}</Label>
              <Input
                id="timesheet-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timesheet-to">{isRTL ? "إلى" : "To"}</Label>
              <Input
                id="timesheet-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
              <CalendarRange className="size-4" />
              {isRTL
                ? "تُجمع المناوبات حسب يوم التشغيل وإعداد المنطقة الزمنية."
                : "Shifts are grouped by the configured operational day and timezone."}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="font-bold flex items-center gap-2">
            <Users className="size-4 text-primary" />
            {isRTL ? "الحالة الحالية" : "Current Staff State"}
          </h2>
          {clockQuery.isLoading ? (
            <Card><CardContent className="p-10 text-center text-muted-foreground">{t.common.loading}</CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {employees.map((employee) => (
                <Card
                  key={employee.id}
                  className={employee.clockedIn ? "border-green-200 dark:border-green-900/60" : ""}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`size-10 rounded-full flex items-center justify-center font-bold ${
                          employee.clockedIn
                            ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {employee.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{employee.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge className={`text-[10px] ${roleColors[employee.role] || "bg-muted text-muted-foreground"}`}>
                            {employee.role}
                          </Badge>
                          {employee.onBreak ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              <Coffee className="size-3 me-1" />
                              {isRTL ? "استراحة" : "On break"}
                            </Badge>
                          ) : employee.clockedIn ? (
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              {isRTL ? "حاضر" : "Working"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {isRTL ? "خارج الدوام" : "Off shift"}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-end text-xs">
                        <div className="font-semibold">{employee.currentSessionHours.toFixed(2)}h</div>
                        <div className="text-muted-foreground">{fmtCurrency(employee.laborCost)}</div>
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground flex justify-between gap-2">
                      <span>{fmtCurrency(employee.hourlyWage)}/{isRTL ? "ساعة" : "hr"}</span>
                      {employee.shiftStartedAt && (
                        <span>{isRTL ? "منذ" : "since"} {fmtTime(employee.shiftStartedAt)}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!employee.clockedIn && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void recordAction(employee, "clock_in")}
                        >
                          <LogIn className="size-4" />
                          {isRTL ? "دخول" : "Clock In"}
                        </Button>
                      )}
                      {employee.clockedIn && !employee.onBreak && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            disabled={Boolean(actionLoading)}
                            onClick={() => void recordAction(employee, "break_start")}
                          >
                            <Coffee className="size-4" />
                            {isRTL ? "بدء استراحة" : "Start Break"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-red-600"
                            disabled={Boolean(actionLoading)}
                            onClick={() => void recordAction(employee, "clock_out")}
                          >
                            <LogOut className="size-4" />
                            {isRTL ? "خروج" : "Clock Out"}
                          </Button>
                        </>
                      )}
                      {employee.onBreak && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          disabled={Boolean(actionLoading)}
                          onClick={() => void recordAction(employee, "break_end")}
                        >
                          <Coffee className="size-4" />
                          {isRTL ? "إنهاء الاستراحة" : "End Break"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <History className="size-4 text-primary" />
              {isRTL ? "المناوبات التاريخية" : "Historical Shifts"}
            </h2>
            <Badge variant="secondary">
              {historySummary.shiftCount || 0} {isRTL ? "مناوبة" : "shifts"}
            </Badge>
          </div>
          <Card>
            <CardContent className="p-0">
              {timesheetQuery.isLoading ? (
                <div className="p-10 text-center text-muted-foreground">{t.common.loading}</div>
              ) : shifts.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  {isRTL ? "لا توجد مناوبات ضمن الفترة" : "No shifts in this period"}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">{isRTL ? "الموظف" : "Employee"}</TableHead>
                        <TableHead>{isRTL ? "يوم التشغيل" : "Operational Day"}</TableHead>
                        <TableHead>{isRTL ? "الدخول / الخروج" : "In / Out"}</TableHead>
                        <TableHead>{isRTL ? "الاستراحة" : "Break"}</TableHead>
                        <TableHead>{isRTL ? "المدفوع" : "Paid"}</TableHead>
                        <TableHead>{isRTL ? "التكلفة" : "Cost"}</TableHead>
                        <TableHead className="text-end pe-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((shift) => (
                        <TableRow key={shift.id}>
                          <TableCell className="ps-4">
                            <div className="font-medium text-sm">{shift.employeeName}</div>
                            <div className="text-xs text-muted-foreground">{shift.employeeRole}</div>
                          </TableCell>
                          <TableCell className="text-sm">{fmtDate(shift.operationalDate)}</TableCell>
                          <TableCell className="text-xs">
                            <div>{fmtTime(shift.startedAt)}</div>
                            <div>{shift.endedAt ? fmtTime(shift.endedAt) : (isRTL ? "مفتوحة" : "Open")}</div>
                          </TableCell>
                          <TableCell className="text-sm">{shift.breakHours.toFixed(2)}h</TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">{shift.paidHours.toFixed(2)}h</div>
                            {shift.adjustmentCount > 0 && (
                              <div className="text-[10px] text-amber-700">
                                {shift.adjustmentCount} {isRTL ? "تصحيح" : "adjustment(s)"}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">{fmtCurrency(shift.laborCost)}</TableCell>
                          <TableCell className="text-end pe-4">
                            {shift.status === "closed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-1.5"
                                onClick={() => setAdjustShift(shift)}
                              >
                                <PencilLine className="size-3.5" />
                                {isRTL ? "تصحيح" : "Adjust"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      {adjustShift && (
        <AdjustmentDialog
          shift={adjustShift}
          isRTL={isRTL}
          onClose={() => setAdjustShift(null)}
          onSaved={async () => {
            setAdjustShift(null);
            await refreshAll();
          }}
        />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          {icon}
        </div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function AdjustmentDialog({
  shift,
  isRTL,
  onClose,
  onSaved,
}: {
  shift: ShiftRow;
  isRTL: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [minutes, setMinutes] = useState("0");
  const [reasonCode, setReasonCode] = useState("manager_correction");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const delta = Number(minutes);
    if (!Number.isFinite(delta) || delta === 0 || reason.trim().length < 3) {
      toast.error(
        isRTL
          ? "أدخل دقائق موجبة أو سالبة وسبباً واضحاً"
          : "Enter non-zero positive/negative minutes and a clear reason"
      );
      return;
    }
    setSaving(true);
    try {
      await jsonFetch("/api/timekeeping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey("time-adjustment"),
        },
        body: JSON.stringify({
          shiftId: shift.id,
          paidMinutesDelta: delta,
          reasonCode,
          reason,
        }),
      });
      toast.success(isRTL ? "تم تسجيل التصحيح" : "Time adjustment recorded");
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save adjustment");
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" dir={isRTL ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isRTL ? "تصحيح وقت مدفوع" : "Paid-Time Adjustment"}</DialogTitle>
          <DialogDescription>
            {shift.employeeName} · {shift.paidHours.toFixed(2)}h
            <br />
            {isRTL
              ? "السجل الأصلي لا يتغير؛ يُضاف تصحيح موقّع ومدقق."
              : "The original shift remains unchanged; a signed audited adjustment is appended."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="adjustment-minutes">
              {isRTL ? "فرق الدقائق (+ أو -)" : "Minute difference (+ or -)"}
            </Label>
            <Input
              id="adjustment-minutes"
              type="number"
              step="1"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjustment-code">{isRTL ? "رمز السبب" : "Reason code"}</Label>
            <Input
              id="adjustment-code"
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adjustment-reason">{isRTL ? "التفسير" : "Explanation"}</Label>
            <Textarea
              id="adjustment-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {isRTL ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? (isRTL ? "جارٍ الحفظ..." : "Saving...") : (isRTL ? "تسجيل التصحيح" : "Record Adjustment")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
