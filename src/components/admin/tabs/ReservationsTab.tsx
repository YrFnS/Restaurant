"use client";

import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AdminLoading, EmptyState, RESERVATION_STATUS_META, StatusBadge, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  CalendarCheck, Search, Filter, Clock, Users, Phone, Mail,
  Loader2, Trash2, StickyNote, CheckCircle2, XCircle, Calendar,
} from "lucide-react";

export function ReservationsTab() {
  const { t, isRTL, locale, fmtDate, fmtTime } = useI18n();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["reservations", "admin"],
    queryFn: async () => (await fetch("/api/reservations")).json(),
    refetchInterval: 30000,
  });
  const reservations: any[] = data?.reservations || [];

  const filtered = useMemo(() => {
    let list = reservations;
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    if (dateFilter) {
      const d = new Date(dateFilter);
      list = list.filter((r) => {
        const rd = new Date(r.dateTime);
        return rd.toDateString() === d.toDateString();
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.customerName.toLowerCase().includes(q) || r.customerPhone.includes(q)
      );
    }
    return list;
  }, [reservations, filter, dateFilter, search]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/api/reservations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      qc.invalidateQueries({ queryKey: ["reservations", "admin"] });
      toast.success(isRTL ? "تم التحديث" : "Updated");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const deleteRes = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذا الحجز؟" : "Delete this reservation?")) return;
    try {
      await apiFetch(`/api/reservations/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["reservations", "admin"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  const statusFilters = [
    { value: "all", label: t.menu.all },
    ...Object.keys(RESERVATION_STATUS_META).map((s) => ({ value: s, label: RESERVATION_STATUS_META[s].label[locale] })),
  ];

  // Group by date
  const grouped = filtered.reduce((acc, r) => {
    const d = new Date(r.dateTime).toDateString();
    if (!acc[d]) acc[d] = [];
    acc[d].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4 max-w-[1600px]">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? "ابحث بالاسم أو الهاتف" : "Search by name or phone"}
            className="ps-9"
          />
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-[150px]"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="size-3.5 me-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {statusFilters.filter((s) => s.value !== "all").map((s) => {
          const count = reservations.filter((r) => r.status === s.value).length;
          const meta = RESERVATION_STATUS_META[s.value];
          return (
            <div key={s.value} className="p-3 rounded-xl border border-border bg-card">
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
              <div className="text-xl font-bold mt-1">{count}</div>
              <div className={`mt-1 h-1 rounded-full ${meta.cls.split(" ")[0]}`} />
            </div>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-0">
            <EmptyState
              icon={<CalendarCheck className="size-6" />}
              title={isRTL ? "لا حجوزات" : "No reservations"}
              description={isRTL ? "ستظهر الحجوزات هنا" : "Reservations will appear here"}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([dateStr, items]) => (
            <Card key={dateStr} className="border-border/60">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border">
                  <Calendar className="size-4 text-primary" />
                  <span className="font-semibold text-sm">{fmtDate(dateStr)}</span>
                  <Badge variant="secondary" className="ms-auto text-[10px]">
                    {items.length} {isRTL ? "حجز" : "reservations"}
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="ps-4">{isRTL ? "الوقت" : "Time"}</TableHead>
                        <TableHead>{isRTL ? "العميل" : "Customer"}</TableHead>
                        <TableHead className="hidden md:table-cell">{isRTL ? "العدد" : "Party"}</TableHead>
                        <TableHead className="hidden lg:table-cell">{isRTL ? "الطاولة" : "Table"}</TableHead>
                        <TableHead className="hidden lg:table-cell">{isRTL ? "المناسبة" : "Occasion"}</TableHead>
                        <TableHead>{t.admin.status}</TableHead>
                        <TableHead className="text-end pe-4">{isRTL ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.id} className="hover:bg-muted/30">
                          <TableCell className="ps-4 font-mono text-xs font-semibold">
                            {fmtTime(r.dateTime)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{r.customerName}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="size-3" />
                              {r.customerPhone}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant="outline" className="gap-1">
                              <Users className="size-3" />
                              {r.partySize}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {r.table ? `#${r.table.number}` : "—"}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {r.occasion || "—"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={r.status} meta={RESERVATION_STATUS_META} locale={locale} />
                          </TableCell>
                          <TableCell className="text-end pe-4">
                            <div className="flex items-center justify-end gap-1">
                              {r.status === "confirmed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 text-amber-700 hover:text-amber-800"
                                  onClick={() => updateStatus(r.id, "seated")}
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  <span className="text-xs hidden sm:inline">{isRTL ? "جلوس" : "Seat"}</span>
                                </Button>
                              )}
                              {r.status === "seated" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 gap-1 text-emerald-700 hover:text-emerald-800"
                                  onClick={() => updateStatus(r.id, "completed")}
                                >
                                  <CheckCircle2 className="size-3.5" />
                                  <span className="text-xs hidden sm:inline">{isRTL ? "إكمال" : "Done"}</span>
                                </Button>
                              )}
                              {r.status !== "cancelled" && r.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-destructive hover:text-destructive"
                                  onClick={() => updateStatus(r.id, "cancelled")}
                                >
                                  <XCircle className="size-3.5" />
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="size-8 text-muted-foreground"
                                onClick={() => deleteRes(r.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
