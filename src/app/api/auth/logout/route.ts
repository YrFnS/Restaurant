import { NextResponse } from "next/server";
import { clearStaffSession } from "@/lib/auth/session";

export async function POST() {
  await clearStaffSession();
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
