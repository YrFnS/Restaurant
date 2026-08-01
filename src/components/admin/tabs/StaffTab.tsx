"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AdminLoading, EmptyState, apiFetch } from "../shared";
import { toast } from "sonner";
import {
  Users, Plus, Pencil, Trash2, Search, Loader2, Phone, Mail,
  ShieldCheck, ShieldOff, DollarSign, UserCircle,
} from "lucide-react";

const ROLE_META: Record<string, { label: { en: string; ar: string }; cls: string; icon: string }> = {
  owner: { label: { en: "Owner", ar: "المالك" }, cls: "bg-red-100 text-red-800 border-red-200", icon: "🏢" },
  admin: { label: { en: "Admin", ar: "مدير" }, cls: "bg-rose-100 text-rose-800 border-rose-200", icon: "👑" },
  manager: { label: { en: "Manager", ar: "مدير فرع" }, cls: "bg-violet-100 text-violet-800 border-violet-200", icon: "🧑‍💼" },
  cashier: { label: { en: "Cashier", ar: "أمين صندوق" }, cls: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: "💳" },
  server: { label: { en: "Server", ar: "نادل" }, cls: "bg-amber-100 text-amber-800 border-amber-200", icon: "🍽️" },
  cook: { label: { en: "Cook", ar: "طباخ" }, cls: "bg-orange-100 text-orange-800 border-orange-200", icon: "👨‍🍳" },
  bartender: { label: { en: "Bartender", ar: "نادل بار" }, cls: "bg-sky-100 text-sky-800 border-sky-200", icon: "🍹" },
  host: { label: { en: "Host", ar: "مستقبل" }, cls: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "🤵" },
  inventory_manager: { label: { en: "Inventory", ar: "مسؤول مخزون" }, cls: "bg-lime-100 text-lime-800 border-lime-200", icon: "📦" },
  analyst: { label: { en: "Analyst", ar: "محلل" }, cls: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "📊" },
  staff: { label: { en: "Staff", ar: "موظف" }, cls: "bg-slate-100 text-slate-800 border-slate-200", icon: "👤" },
};

export function StaffTab() {
  const { t, isRTL, locale } = useI18n();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; emp?: any }>({ open: false });

  const { data, isLoading } = useQuery({
    queryKey: ["employees", "admin"],
    queryFn: async () => {
      const response = await fetch("/api/employees", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || "Unable to load employees");
      return payload;
    },
  });
  const employees: any[] = data?.employees || [];

  const filtered = employees.filter((employee) => {
    if (roleFilter !== "all" && employee.role !== roleFilter) return false;
    if (search) {
      const query = search.toLowerCase();
      if (
        !employee.name.toLowerCase().includes(query) &&
        !(employee.email || "").toLowerCase().includes(query) &&
        !(employee.phone || "").includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  const remove = async (id: string) => {
    if (!confirm(isRTL ? "حذف هذا الموظف؟" : "Delete this employee?")) return;
    try {
      await apiFetch(`/api/employees/${id}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["employees", "admin"] });
      toast.success(isRTL ? "تم الحذف" : "Deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const toggleActive = async (employee: any) => {
    try {
      await apiFetch(`/api/employees/${employee.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !employee.isActive }),
      });
      qc.invalidateQueries({ queryKey: ["employees", "admin"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) return <AdminLoading label={t.common.loading} />;

  return (
    <div className="space-y-4 max-w-[1600px]">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isRTL ? "ابحث بالاسم أو الهاتف أو البريد" : "Search by name, phone or email"}
              className="ps-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.menu.all}</SelectItem>
              {Object.keys(ROLE_META).map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_META[role].icon} {ROLE_META[role].label[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setDialog({ open: true })} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          {t.admin.addStaff}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-11 gap-2">
        {Object.keys(ROLE_META).map((role) => {
          const count = employees.filter((employee) => employee.role === role).length;
          return (
            <div key={role} className="p-3 rounded-xl border border-border bg-card">
              <div className="text-lg">{ROLE_META[role].icon}</div>
              <div className="text-xs font-medium text-muted-foreground mt-1">
                {ROLE_META[role].label[locale]}
              </div>
              <div className="text-xl font-bold">{count}</div>
            </div>
          );
        })}
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title={isRTL ? "لا موظفين" : "No staff"}
              action={
                <Button size="sm" className="gap-1.5" onClick={() => setDialog({ open: true })}>
                  <Plus className="size-4" />
                  {t.admin.addStaff}
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">{isRTL ? "الموظف" : "Employee"}</TableHead>
                    <TableHead>{t.admin.role}</TableHead>
                    <TableHead className="hidden lg:table-cell">{isRTL ? "التواصل" : "Contact"}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.admin.wage}</TableHead>
                    <TableHead>{t.admin.active}</TableHead>
                    <TableHead className="text-end pe-4">{t.admin.edit}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((employee) => {
                    const role = ROLE_META[employee.role] || ROLE_META.staff;
                    return (
                      <TableRow key={employee.id} className="hover:bg-muted/30">
                        <TableCell className="ps-4">
                          <div className="flex items-center gap-3">
                            <div className={`size-10 rounded-full flex items-center justify-center text-base font-bold shrink-0 ${role.cls}`}>
                              {employee.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {employee.clockedIn ? (
                                  <span className="text-emerald-600 flex items-center gap-0.5">
                                    <span className="size-1.5 rounded-full bg-emerald-500" />
                                    {isRTL ? "مسجّل دخول" : "Clocked in"}
                                  </span>
                                ) : (
                                  <span>{isRTL ? "غير مسجّل" : "Off shift"}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${role.cls} hover:${role.cls}`}>
                            <span className="me-1">{role.icon}</span>
                            {role.label[locale]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {employee.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="size-3" /> {employee.phone}
                              </div>
                            )}
                            {employee.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="size-3" /> {employee.email}
                              </div>
                            )}
                            {!employee.phone && !employee.email && "—"}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          <span className="font-semibold text-primary">${employee.hourlyWage?.toFixed(2)}</span>
                          <span className="text-xs text-muted-foreground">/hr</span>
                        </TableCell>
                        <TableCell>
                          <Switch checked={employee.isActive} onCheckedChange={() => toggleActive(employee)} />
                        </TableCell>
                        <TableCell className="text-end pe-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="size-8" onClick={() => setDialog({ open: true, emp: employee })}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => remove(employee.id)}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {dialog.open && (
        <StaffDialog
          emp={dialog.emp}
          onClose={() => setDialog({ open: false })}
          onSaved={() => {
            setDialog({ open: false });
            qc.invalidateQueries({ queryKey: ["employees", "admin"] });
          }}
        />
      )}
    </div>
  );
}

function StaffDialog({ emp, onClose, onSaved }: { emp?: any; onClose: () => void; onSaved: () => void }) {
  const { t, isRTL } = useI18n();
  const [form, setForm] = useState({
    name: emp?.name || "",
    pin: "",
    role: emp?.role || "staff",
    hourlyWage: emp?.hourlyWage || 12,
    isActive: emp?.isActive ?? true,
    email: emp?.email || "",
    phone: emp?.phone || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.name || (!emp && !form.pin)) {
      toast.error(isRTL ? "الاسم والرمز مطلوبان" : "Name and PIN required");
      return;
    }
    if (form.pin && form.pin.length < 4) {
      toast.error(isRTL ? "الرمز يجب أن يكون 4 خانات على الأقل" : "PIN must be at least 4 digits");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        hourlyWage: Number(form.hourlyWage),
        isActive: form.isActive,
        email: form.email || null,
        phone: form.phone || null,
      };
      if (form.pin) payload.pin = form.pin;

      if (emp) {
        await apiFetch(`/api/employees/${emp.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success(isRTL ? "تم الحفظ" : "Saved");
      } else {
        await apiFetch("/api/employees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(isRTL ? "تمت الإضافة" : "Created");
      }
      onSaved();
    } catch (error: any) {
      toast.error(error.message);
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="size-5 text-primary" />
            {emp ? t.admin.editStaff : t.admin.addStaff}
          </DialogTitle>
          <DialogDescription>
            {isRTL ? "أدخل بيانات الموظف" : "Enter staff details"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{isRTL ? "الاسم الكامل *" : "Full Name *"}</Label>
            <Input value={form.name} onChange={(event) => set("name", event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                {t.admin.pin}{emp ? "" : " *"}
              </Label>
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                value={form.pin}
                onChange={(event) => set("pin", event.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder={emp ? (isRTL ? "اتركه فارغاً للإبقاء" : "Leave blank to keep") : "••••"}
                dir="ltr"
                className="font-mono tracking-widest"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.role}</Label>
              <Select value={form.role} onValueChange={(value) => set("role", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ROLE_META).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_META[role].icon} {ROLE_META[role].label[isRTL ? "ar" : "en"]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                <DollarSign className="size-3" />{t.admin.wage}
              </Label>
              <Input type="number" step="0.5" value={form.hourlyWage} onChange={(event) => set("hourlyWage", event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t.admin.phone}</Label>
              <Input value={form.phone} onChange={(event) => set("phone", event.target.value)} dir="ltr" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.email}</Label>
            <Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} dir="ltr" />
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-2">
              {form.isActive ? <ShieldCheck className="size-4 text-emerald-600" /> : <ShieldOff className="size-4 text-muted-foreground" />}
              <span className="text-sm font-medium">{t.admin.active}</span>
            </div>
            <Switch checked={form.isActive} onCheckedChange={(value) => set("isActive", value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.admin.cancel}</Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t.admin.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
