import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPin } from '@/lib/pin-hash';
import { sanitizeString } from '@/lib/sanitize';

// Allowed fields for creating/updating employees
const ALLOWED_FIELDS = ['name', 'pin', 'role', 'hourlyWage', 'isActive', 'email', 'phone'] as const;

function validateEmployeeInput(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for disallowed fields
  const extraFields = Object.keys(body).filter(k => !ALLOWED_FIELDS.includes(k as typeof ALLOWED_FIELDS[number]));
  if (extraFields.length > 0) {
    errors.push(`Fields not allowed: ${extraFields.join(', ')}`);
  }

  // Validate name
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    } else if (body.name.length > 255) {
      errors.push('Name must be at most 255 characters');
    }
  }

  // Validate pin
  if (body.pin !== undefined) {
    if (typeof body.pin !== 'string' || !/^\d{4,6}$/.test(body.pin)) {
      errors.push('PIN must be 4-6 digits');
    }
  }

  // Validate role
  if (body.role !== undefined) {
    if (!['admin', 'manager', 'staff'].includes(body.role as string)) {
      errors.push('Role must be admin, manager, or staff');
    }
  }

  // Validate hourlyWage
  if (body.hourlyWage !== undefined) {
    const wage = Number(body.hourlyWage);
    if (isNaN(wage) || wage < 0 || wage > 1000) {
      errors.push('Hourly wage must be between 0 and 1000');
    }
  }

  // Validate email
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string' || body.email.length > 255) {
      errors.push('Email must be at most 255 characters');
    }
  }

  // Validate phone
  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    if (typeof body.phone !== 'string' || body.phone.length > 50) {
      errors.push('Phone must be at most 50 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

// Omit pin from employee response
function omitPin(employee: Record<string, unknown>) {
  const { pin: _pin, ...rest } = employee;
  return rest;
}

export async function GET() {
  try {
    const employees = await db.employee.findMany({ orderBy: { name: 'asc' } });
    // Remove PIN from all responses
    const safeEmployees = employees.map(emp => {
      const { pin: _pin, ...rest } = emp;
      return rest;
    });
    return NextResponse.json({ employees: safeEmployees });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate input
    const { valid, errors } = validateEmployeeInput(body);
    if (!valid) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const { name, pin, role, hourlyWage, isActive, email, phone } = body;

    if (!name || !pin) {
      return NextResponse.json({ error: 'Name and PIN are required' }, { status: 400 });
    }

    // Sanitize string inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedEmail = email ? sanitizeString(email) : null;
    const sanitizedPhone = phone ? sanitizeString(phone) : null;

    // Hash the PIN before storing
    const hashedPin = hashPin(pin);

    const employee = await db.employee.create({
      data: {
        name: sanitizedName,
        pin: hashedPin,
        role: role || 'staff',
        hourlyWage: hourlyWage || 15,
        isActive: isActive !== false,
        email: sanitizedEmail,
        phone: sanitizedPhone,
      },
    });

    // Remove PIN from response
    return NextResponse.json({ employee: omitPin(employee) });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json({ error: 'PIN already in use' }, { status: 409 });
    }
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
  }
}
