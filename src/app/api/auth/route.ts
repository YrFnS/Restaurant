import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPin } from '@/lib/pin-hash';
import { encodeSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 requests per minute per IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { success, remaining } = rateLimit(`auth:${ip}`, 5, 60 * 1000);

    if (!success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { pin } = body;

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'PIN is required' }, { status: 400 });
    }

    if (pin.length < 4 || pin.length > 6) {
      return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
    }

    // Find employee by PIN hash
    const employees = await db.employee.findMany({ where: { isActive: true } });
    const employee = employees.find(emp => verifyPin(pin, emp.pin));

    if (!employee) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401, headers: { 'X-RateLimit-Remaining': String(remaining) } }
      );
    }

    // Create session
    const session = { id: employee.id, name: employee.name, role: employee.role };
    const sessionToken = encodeSession(session);

    const response = NextResponse.json({
      success: true,
      employee: { id: employee.id, name: employee.name, role: employee.role },
    });

    // Set cookie (httpOnly: false so client can read it too)
    response.cookies.set('staff_session', sessionToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during authentication:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
