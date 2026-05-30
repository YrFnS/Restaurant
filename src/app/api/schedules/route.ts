import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const schedules = await db.schedule.findMany({
      include: { employee: { select: { name: true } } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    const mapped = schedules.map(s => ({ ...s, employeeName: s.employee.name }));
    return NextResponse.json({ schedules: mapped });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { employeeId, dayOfWeek, startTime, endTime, role } = body;
    if (!employeeId) return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    const schedule = await db.schedule.create({
      data: { employeeId, dayOfWeek: dayOfWeek || 1, startTime: startTime || '09:00', endTime: endTime || '17:00', role: role || 'Server' },
    });
    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}
