"use client";

export const POS_REGISTER_STORAGE_KEY = "restaurant-pos-register";
export const POS_REGISTER_UPDATED_EVENT = "restaurant:register-updated";

export interface StoredPosRegister {
  id: string;
  code: string;
  name: string;
  deviceId: string;
}

export interface OpenPosRegisterSession {
  id: string;
  registerId: string;
  status: "open";
  openingFloat: number;
  openedById: string;
  openedByName: string;
  openedAt: string;
}

function isStoredRegister(value: unknown): value is StoredPosRegister {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.code === "string" &&
    candidate.code.length > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0 &&
    typeof candidate.deviceId === "string" &&
    candidate.deviceId.length > 0
  );
}

export function readStoredPosRegister(): StoredPosRegister | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(POS_REGISTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredRegister(parsed)) {
      window.localStorage.removeItem(POS_REGISTER_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(POS_REGISTER_STORAGE_KEY);
    return null;
  }
}

export function saveStoredPosRegister(register: StoredPosRegister): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(POS_REGISTER_STORAGE_KEY, JSON.stringify(register));
  window.dispatchEvent(new Event(POS_REGISTER_UPDATED_EVENT));
}

export function clearStoredPosRegister(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(POS_REGISTER_STORAGE_KEY);
  window.dispatchEvent(new Event(POS_REGISTER_UPDATED_EVENT));
}

export function registerRequestHeaders(
  register: StoredPosRegister,
  extra?: HeadersInit
): Headers {
  const headers = new Headers(extra);
  headers.set("X-Register-Id", register.id);
  headers.set("X-Register-Device-Id", register.deviceId);
  return headers;
}

export function createRegisterIdempotencyKey(prefix: string): string {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  return `${prefix}-${suffix}`;
}

export async function requireOpenPosRegister(): Promise<{
  register: StoredPosRegister;
  session: OpenPosRegisterSession;
}> {
  const register = readStoredPosRegister();
  if (!register) {
    throw new Error("Select a cash register before completing a sale");
  }

  const response = await fetch(
    `/api/registers/${encodeURIComponent(register.id)}/session`,
    {
      headers: registerRequestHeaders(register),
      cache: "no-store",
    }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "Unable to verify the cash register");
  }
  if (!data?.session || data.session.status !== "open") {
    throw new Error("Open the cash register before completing a sale");
  }

  return { register, session: data.session as OpenPosRegisterSession };
}
