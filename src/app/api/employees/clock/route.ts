import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Clock in/out an employee by PIN or ID
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin, employeeId, action } = body;
    // action: "in" | "out"

    let employee;
    if (employeeId) {
      employee = await db.employee.findUnique({ where: { id: employeeId } });
    } else if (pin) {
      employee = await db.employee.findUnique({ where: { pin } });
    }

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const now = new Date();
    if (action === "in") {
      employee = await db.employee.update({
        where: { id: employee.id },
        data: { clockedIn: true, lastClockIn: now },
      });
    } else if (action === "out") {
      employee = await db.employee.update({
        where: { id: employee.id },
        data: { clockedIn: false, lastClockOut: now },
      });
    }

    // Calculate hours worked in current session (if clocked in)
    let sessionHours = 0;
    if (employee.clockedIn && employee.lastClockIn) {
      sessionHours = (now.getTime() - employee.lastClockIn.getTime()) / 3600000;
    }

    return NextResponse.json({
      employee,
      sessionHours: Math.round(sessionHours * 100) / 100,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Get all employees with clock status
export async function GET() {
  const employees = await db.employee.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, role: true, hourlyWage: true,
      clockedIn: true, lastClockIn: true, lastClockOut: true,
    },
  });

  const now = new Date();
  const withHours = employees.map((e) => {
    let currentSessionHours = 0;
    if (e.clockedIn && e.lastClockIn) {
      currentSessionHours = (now.getTime() - e.lastClockIn.getTime()) / 3600000;
    }
    return { ...e, currentSessionHours: Math.round(currentSessionHours * 100) / 100 };
  });

  const clockedInCount = employees.filter((e) => e.clockedIn).length;
  const totalHoursToday = withHours.reduce((s, e) => s + e.currentSessionHours, 0);

  return NextResponse.json({
    employees: withHours,
    clockedInCount,
    totalHoursToday: Math.round(totalHoursToday * 100) / 100,
  });
}
