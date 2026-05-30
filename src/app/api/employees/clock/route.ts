import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPin } from "@/lib/pin-hash";

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    // Find employee by comparing hashed PIN
    const employees = await db.employee.findMany({ where: { isActive: true } });
    const employee = employees.find(emp => verifyPin(pin, emp.pin));

    if (!employee) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const now = new Date();
    const clockedIn = !employee.clockedIn;

    const updated = await db.employee.update({
      where: { id: employee.id },
      data: {
        clockedIn,
        lastClockIn: clockedIn ? now : employee.lastClockIn,
        lastClockOut: clockedIn ? employee.lastClockOut : now,
      },
    });

    // Remove PIN from response
    const { pin: _pin, ...safeUpdated } = updated;
    return NextResponse.json(safeUpdated);
  } catch (error) {
    console.error("Error clocking in/out:", error);
    return NextResponse.json({ error: "Failed to clock in/out" }, { status: 500 });
  }
}
