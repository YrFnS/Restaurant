"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  Loader2,
  Lock,
  Monitor,
  Plus,
  RefreshCw,
  Unlock,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  POS_REGISTER_UPDATED_EVENT,
  clearStoredPosRegister,
  createRegisterIdempotencyKey,
  readStoredPosRegister,
  registerRequestHeaders,
  saveStoredPosRegister,
  type StoredPosRegister,
} from "@/lib/cash/register-client";

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

interface RegisterSession {
  id: string;
  registerId: string;
  status: "open" | "closed";
  openingFloat: number;
  openedById: string;
  openedByName: string;
  openedAt: string;
  closedAt: string | null;
}

interface CashRegister extends StoredPosRegister {
  location: string;
  discrepancyApprovalThreshold: number;
  isActive: boolean;
  currentSession: RegisterSession | null;
}

interface SessionResponse {
  register: CashRegister;
  session: RegisterSession | null;
}

interface LedgerResponse {
  register: CashRegister;
  session: RegisterSession;
  entries: Array<{
    id: string;
    type: string;
    amount: number;
    note: string | null;
    createdAt: string;
    registerSessionId: string;
  }>;
  balance: number;
}

class ClientApiError extends Error {
  readonly code: string | null;
  readonly status: number;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ClientApiError(
      data?.error || "The register request failed",
      response.status,
      data?.code || null
    );
  }
  return data as T;
}

function numericInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function registerFromDto(register: CashRegister): StoredPosRegister {
  return {
    id: register.id,
    code: register.code,
    name: register.name,
    deviceId: register.deviceId,
  };
}

const CASH_ROLES = new Set(["owner", "admin", "manager", "cashier"]);
const MANAGER_ROLES = new Set(["owner", "admin", "manager"]);

export function RegisterSessionControl() {
  const { isRTL, fmtCurrency } = useI18n();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [storedRegister, setStoredRegister] =
    useState<StoredPosRegister | null>(null);
  const [openingFloat, setOpeningFloat] = useState("0.00");
  const [countedCash, setCountedCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [busyAction, setBusyAction] = useState<
    "create" | "open" | "close" | null
  >(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newThreshold, setNewThreshold] = useState("0.00");
  const openKeyRef = useRef<string | null>(null);
  const closeKeyRef = useRef<string | null>(null);

  const copy = isRTL
    ? {
        register: "الصندوق",
        registerSettings: "إدارة صندوق نقطة البيع",
        selectRegister: "اختر الصندوق المخصص لهذا الجهاز",
        noRegister: "لم يتم ربط صندوق بهذا الجهاز",
        closed: "مغلق",
        open: "مفتوح",
        expectedCash: "النقد المتوقع",
        openingFloat: "رصيد الافتتاح",
        countedCash: "النقد المعدود",
        discrepancy: "الفرق",
        openedBy: "فتح بواسطة",
        openRegister: "فتح الصندوق",
        closeRegister: "إغلاق الصندوق",
        refresh: "تحديث",
        note: "ملاحظة الإغلاق",
        approvalReason: "سبب موافقة المدير",
        managerRequired: "الفرق يتجاوز الحد ويتطلب مديراً للموافقة.",
        createRegister: "إنشاء صندوق لهذا الجهاز",
        code: "رمز الصندوق",
        name: "اسم الصندوق",
        location: "الموقع",
        deviceId: "معرّف الجهاز",
        threshold: "حد الفرق قبل موافقة المدير",
        create: "إنشاء وربط",
        noCashAccess: "هذا المستخدم لا يملك صلاحية إدارة النقد.",
        assignmentHelp:
          "اختيار الصندوق يحفظ ربط هذا المتصفح بالجهاز. افتح جلسة قبل تحصيل أي دفعة نقدية.",
      }
    : {
        register: "Register",
        registerSettings: "POS cash register",
        selectRegister: "Select the register assigned to this device",
        noRegister: "No register is assigned to this device",
        closed: "Closed",
        open: "Open",
        expectedCash: "Expected cash",
        openingFloat: "Opening float",
        countedCash: "Counted cash",
        discrepancy: "Discrepancy",
        openedBy: "Opened by",
        openRegister: "Open register",
        closeRegister: "Close register",
        refresh: "Refresh",
        note: "Closing note",
        approvalReason: "Manager approval reason",
        managerRequired:
          "This discrepancy exceeds the threshold and requires a manager.",
        createRegister: "Create a register for this device",
        code: "Register code",
        name: "Register name",
        location: "Location",
        deviceId: "Device identity",
        threshold: "Manager-approval discrepancy threshold",
        create: "Create and assign",
        noCashAccess: "This staff account cannot manage cash.",
        assignmentHelp:
          "Selecting a register stores this browser's device assignment. Open a session before collecting cash.",
      };

  useEffect(() => {
    const sync = () => setStoredRegister(readStoredPosRegister());
    sync();
    window.addEventListener(POS_REGISTER_UPDATED_EVENT, sync);
    return () => window.removeEventListener(POS_REGISTER_UPDATED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (newDeviceId) return;
    const suffix =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    setNewDeviceId(`web-pos-${suffix}`);
    setNewCode(`POS-${suffix.replaceAll("-", "").slice(0, 8).toUpperCase()}`);
    setNewName(isRTL ? "صندوق نقطة البيع" : "POS Register");
  }, [isRTL, newDeviceId]);

  const staffQuery = useQuery({
    queryKey: ["staff-session"],
    queryFn: async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      return responseJson<{ user: StaffUser }>(response);
    },
    retry: false,
    staleTime: 30_000,
  });

  const registersQuery = useQuery({
    queryKey: ["pos-registers"],
    queryFn: async () => {
      const response = await fetch("/api/registers", { cache: "no-store" });
      return responseJson<{ registers: CashRegister[] }>(response);
    },
    retry: false,
    staleTime: 10_000,
  });

  const registers = registersQuery.data?.registers || [];
  const selectedRegister = useMemo(
    () =>
      storedRegister
        ? registers.find((register) => register.id === storedRegister.id) || null
        : null,
    [registers, storedRegister]
  );

  useEffect(() => {
    if (!registersQuery.isSuccess) return;
    if (storedRegister && !selectedRegister) {
      clearStoredPosRegister();
      return;
    }
    if (!storedRegister) {
      const active = registers.filter((register) => register.isActive);
      if (active.length === 1) saveStoredPosRegister(registerFromDto(active[0]));
    }
  }, [registers, registersQuery.isSuccess, selectedRegister, storedRegister]);

  useEffect(() => {
    if (!selectedRegister || !storedRegister) return;
    if (
      selectedRegister.code !== storedRegister.code ||
      selectedRegister.name !== storedRegister.name ||
      selectedRegister.deviceId !== storedRegister.deviceId
    ) {
      saveStoredPosRegister(registerFromDto(selectedRegister));
    }
  }, [selectedRegister, storedRegister]);

  const sessionQuery = useQuery({
    queryKey: ["pos-register-session", storedRegister?.id],
    enabled: Boolean(storedRegister),
    queryFn: async () => {
      if (!storedRegister) throw new Error("Register assignment is missing");
      const response = await fetch(
        `/api/registers/${encodeURIComponent(storedRegister.id)}/session`,
        {
          headers: registerRequestHeaders(storedRegister),
          cache: "no-store",
        }
      );
      return responseJson<SessionResponse>(response);
    },
    retry: false,
    refetchInterval: 30_000,
  });

  const session = sessionQuery.data?.session || null;
  const ledgerQuery = useQuery({
    queryKey: ["pos-register-ledger", storedRegister?.id, session?.id],
    enabled: Boolean(storedRegister && session?.status === "open"),
    queryFn: async () => {
      if (!storedRegister) throw new Error("Register assignment is missing");
      const response = await fetch("/api/cash", {
        headers: registerRequestHeaders(storedRegister),
        cache: "no-store",
      });
      return responseJson<LedgerResponse>(response);
    },
    retry: false,
    refetchInterval: 15_000,
  });

  const expectedCash = ledgerQuery.data?.balance ?? null;
  const counted = numericInput(countedCash);
  const discrepancy =
    counted !== null && expectedCash !== null
      ? Math.round((counted - expectedCash) * 100) / 100
      : null;
  const threshold = selectedRegister?.discrepancyApprovalThreshold ?? 0;
  const approvalRequired =
    discrepancy !== null && Math.abs(discrepancy) > threshold;
  const role = staffQuery.data?.user.role || "";
  const canManageCash = CASH_ROLES.has(role);
  const canApprove = MANAGER_ROLES.has(role);

  useEffect(() => {
    if (session?.status === "open" && expectedCash !== null && !countedCash) {
      setCountedCash(expectedCash.toFixed(2));
    }
  }, [countedCash, expectedCash, session?.status]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pos-registers"] }),
      queryClient.invalidateQueries({ queryKey: ["pos-register-session"] }),
      queryClient.invalidateQueries({ queryKey: ["pos-register-ledger"] }),
    ]);
  }

  function selectRegister(registerId: string) {
    const register = registers.find((candidate) => candidate.id === registerId);
    if (!register) {
      clearStoredPosRegister();
      return;
    }
    saveStoredPosRegister(registerFromDto(register));
    setCountedCash("");
    setApprovalReason("");
    setCloseNote("");
  }

  async function createRegister() {
    const thresholdValue = numericInput(newThreshold);
    if (
      !newCode.trim() ||
      !newName.trim() ||
      !newDeviceId.trim() ||
      thresholdValue === null
    ) {
      toast.error(isRTL ? "أكمل بيانات الصندوق" : "Complete the register details");
      return;
    }

    setBusyAction("create");
    try {
      const response = await fetch("/api/registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          name: newName,
          deviceId: newDeviceId,
          location: newLocation,
          discrepancyApprovalThreshold: thresholdValue,
        }),
      });
      const data = await responseJson<{ register: CashRegister }>(response);
      saveStoredPosRegister(registerFromDto(data.register));
      await refreshAll();
      toast.success(
        isRTL ? "تم إنشاء وربط الصندوق" : "Register created and assigned"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Register creation failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function openRegister() {
    if (!storedRegister) return;
    const opening = numericInput(openingFloat);
    if (opening === null) {
      toast.error(isRTL ? "رصيد الافتتاح غير صالح" : "Opening float is invalid");
      return;
    }

    setBusyAction("open");
    openKeyRef.current ??= createRegisterIdempotencyKey("pos-register-open");
    try {
      const response = await fetch(
        `/api/registers/${encodeURIComponent(storedRegister.id)}/session`,
        {
          method: "POST",
          headers: registerRequestHeaders(storedRegister, {
            "Content-Type": "application/json",
            "Idempotency-Key": openKeyRef.current,
          }),
          body: JSON.stringify({ openingFloat: opening }),
        }
      );
      await responseJson(response);
      openKeyRef.current = null;
      setCountedCash("");
      await refreshAll();
      toast.success(isRTL ? "تم فتح الصندوق" : "Register opened");
    } catch (error) {
      if (error instanceof ClientApiError && error.code === "REGISTER_ALREADY_OPEN") {
        openKeyRef.current = null;
        await refreshAll();
      }
      toast.error(error instanceof Error ? error.message : "Register opening failed");
    } finally {
      setBusyAction(null);
    }
  }

  async function closeRegister() {
    if (!storedRegister || !session) return;
    if (counted === null) {
      toast.error(isRTL ? "أدخل النقد المعدود" : "Enter the counted cash");
      return;
    }
    if (approvalRequired && !canApprove) {
      toast.error(copy.managerRequired);
      return;
    }
    if (approvalRequired && !approvalReason.trim()) {
      toast.error(copy.approvalReason);
      return;
    }

    setBusyAction("close");
    closeKeyRef.current ??= createRegisterIdempotencyKey("pos-register-close");
    try {
      const response = await fetch(
        `/api/registers/${encodeURIComponent(storedRegister.id)}/session`,
        {
          method: "PATCH",
          headers: registerRequestHeaders(storedRegister, {
            "Content-Type": "application/json",
            "Idempotency-Key": closeKeyRef.current,
          }),
          body: JSON.stringify({
            sessionId: session.id,
            countedCash: counted,
            note: closeNote.trim() || null,
            approvalReason:
              approvalRequired && approvalReason.trim()
                ? approvalReason.trim()
                : null,
          }),
        }
      );
      await responseJson(response);
      closeKeyRef.current = null;
      setCountedCash("");
      setCloseNote("");
      setApprovalReason("");
      await refreshAll();
      toast.success(isRTL ? "تم إغلاق وتسوية الصندوق" : "Register closed and reconciled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Register closing failed");
    } finally {
      setBusyAction(null);
    }
  }

  if (staffQuery.isLoading) return null;
  if (!canManageCash) return null;

  const loading =
    registersQuery.isLoading ||
    (Boolean(storedRegister) && sessionQuery.isLoading);
  const buttonLabel = !storedRegister
    ? copy.noRegister
    : session?.status === "open"
      ? `${storedRegister.code} · ${copy.open}`
      : `${storedRegister.code} · ${copy.closed}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={`fixed top-[4.35rem] left-1/2 -translate-x-1/2 z-40 h-9 max-w-[min(90vw,420px)] px-3 rounded-full border shadow-md backdrop-blur flex items-center gap-2 text-xs font-semibold transition-colors ${
          session?.status === "open"
            ? "bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            : "bg-background/95 border-border text-foreground hover:bg-accent"
        }`}
        aria-label={copy.registerSettings}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : session?.status === "open" ? (
          <Unlock className="size-3.5" />
        ) : (
          <Lock className="size-3.5" />
        )}
        <span className="truncate">{buttonLabel}</span>
        {session?.status === "open" && expectedCash !== null && (
          <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
            {fmtCurrency(expectedCash)}
          </Badge>
        )}
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5" />
            {copy.registerSettings}
          </DialogTitle>
          <DialogDescription>{copy.assignmentHelp}</DialogDescription>

          <section className="space-y-3 rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold" htmlFor="pos-register-select">
                {copy.selectRegister}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={refreshAll}
                disabled={registersQuery.isFetching || sessionQuery.isFetching}
              >
                <RefreshCw
                  className={`size-3.5 ${
                    registersQuery.isFetching || sessionQuery.isFetching
                      ? "animate-spin"
                      : ""
                  }`}
                />
                {copy.refresh}
              </Button>
            </div>
            <select
              id="pos-register-select"
              value={storedRegister?.id || ""}
              onChange={(event) => selectRegister(event.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{copy.noRegister}</option>
              {registers
                .filter((register) => register.isActive)
                .map((register) => (
                  <option key={register.id} value={register.id}>
                    {register.code} — {register.name}
                    {register.location ? ` · ${register.location}` : ""}
                  </option>
                ))}
            </select>
            {registersQuery.error instanceof ClientApiError && (
              <p className="text-xs text-destructive">
                {registersQuery.error.status === 403
                  ? copy.noCashAccess
                  : registersQuery.error.message}
              </p>
            )}
            {selectedRegister && (
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md bg-muted/50 p-2">
                  <Monitor className="size-3.5 mb-1" />
                  <span className="break-all">{selectedRegister.deviceId}</span>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <CircleDollarSign className="size-3.5 mb-1" />
                  {copy.threshold}: {fmtCurrency(threshold)}
                </div>
              </div>
            )}
          </section>

          {storedRegister && !session && (
            <section className="space-y-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-3">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-amber-600" />
                <h3 className="font-semibold text-sm">{copy.closed}</h3>
              </div>
              <label className="block text-xs font-medium">
                {copy.openingFloat}
                <input
                  inputMode="decimal"
                  value={openingFloat}
                  onChange={(event) => setOpeningFloat(event.target.value)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm tabular-nums"
                />
              </label>
              <Button
                type="button"
                className="w-full"
                onClick={openRegister}
                disabled={busyAction !== null}
              >
                {busyAction === "open" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Unlock className="size-4" />
                )}
                {copy.openRegister}
              </Button>
            </section>
          )}

          {storedRegister && session?.status === "open" && (
            <section className="space-y-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Unlock className="size-4 text-emerald-600" />
                  <h3 className="font-semibold text-sm">{copy.open}</h3>
                </div>
                <Badge variant="outline">
                  {copy.openedBy}: {session.openedByName}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background border border-border p-3">
                  <p className="text-xs text-muted-foreground">{copy.openingFloat}</p>
                  <p className="font-bold tabular-nums">
                    {fmtCurrency(session.openingFloat)}
                  </p>
                </div>
                <div className="rounded-lg bg-background border border-border p-3">
                  <p className="text-xs text-muted-foreground">{copy.expectedCash}</p>
                  <p className="font-bold tabular-nums">
                    {expectedCash === null ? "—" : fmtCurrency(expectedCash)}
                  </p>
                </div>
              </div>

              <label className="block text-xs font-medium">
                {copy.countedCash}
                <input
                  inputMode="decimal"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                  className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm tabular-nums"
                />
              </label>

              {discrepancy !== null && (
                <div
                  className={`rounded-lg border p-3 flex items-center justify-between gap-3 ${
                    approvalRequired
                      ? "border-destructive/40 bg-destructive/5 text-destructive"
                      : "border-border bg-background"
                  }`}
                >
                  <span className="text-xs font-medium">{copy.discrepancy}</span>
                  <span className="font-bold tabular-nums">
                    {discrepancy > 0 ? "+" : ""}
                    {fmtCurrency(discrepancy)}
                  </span>
                </div>
              )}

              {approvalRequired && (
                <>
                  <p className="text-xs text-destructive">{copy.managerRequired}</p>
                  {canApprove && (
                    <label className="block text-xs font-medium">
                      {copy.approvalReason}
                      <textarea
                        value={approvalReason}
                        onChange={(event) => setApprovalReason(event.target.value)}
                        className="mt-1 w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  )}
                </>
              )}

              <label className="block text-xs font-medium">
                {copy.note}
                <textarea
                  value={closeNote}
                  onChange={(event) => setCloseNote(event.target.value)}
                  className="mt-1 w-full min-h-16 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </label>

              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={closeRegister}
                disabled={
                  busyAction !== null ||
                  counted === null ||
                  (approvalRequired && !canApprove) ||
                  (approvalRequired && canApprove && !approvalReason.trim())
                }
              >
                {busyAction === "close" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                {copy.closeRegister}
              </Button>
            </section>
          )}

          {MANAGER_ROLES.has(role) && (
            <details className="rounded-xl border border-border p-3">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold">
                <Plus className="size-4" />
                {copy.createRegister}
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-medium">
                  {copy.code}
                  <input
                    value={newCode}
                    onChange={(event) => setNewCode(event.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium">
                  {copy.name}
                  <input
                    value={newName}
                    onChange={(event) => setNewName(event.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium col-span-2">
                  {copy.location}
                  <input
                    value={newLocation}
                    onChange={(event) => setNewLocation(event.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </label>
                <label className="text-xs font-medium col-span-2">
                  {copy.deviceId}
                  <input
                    value={newDeviceId}
                    onChange={(event) => setNewDeviceId(event.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm font-mono"
                  />
                </label>
                <label className="text-xs font-medium col-span-2">
                  {copy.threshold}
                  <input
                    inputMode="decimal"
                    value={newThreshold}
                    onChange={(event) => setNewThreshold(event.target.value)}
                    className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
                  />
                </label>
                <Button
                  type="button"
                  className="col-span-2"
                  onClick={createRegister}
                  disabled={busyAction !== null}
                >
                  {busyAction === "create" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {copy.create}
                </Button>
              </div>
            </details>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
