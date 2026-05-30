import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { hashPin } from '@/lib/pin-hash';
import { sanitizeString } from '@/lib/sanitize';

const ALLOWED_FIELDS = ['name', 'pin', 'role', 'hourlyWage', 'isActive', 'email', 'phone'] as const;

function validateEmployeeUpdateInput(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for disallowed fields (don't allow id changes)
  const extraFields = Object.keys(body).filter(k => !ALLOWED_FIELDS.includes(k as typeof ALLOWED_FIELDS[number]));
  if (extraFields.length > 0) {
    errors.push(`Fields not allowed: ${extraFields.join(', ')}`);
  }

  // Validate name
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      errors.push('Name must be a non-empty string');
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

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate input
    const { valid, errors } = validateEmployeeUpdateInput(body);
    if (!valid) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    // Build update data with only allowed fields, hashing PIN if present
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = sanitizeString(body.name);
    if (body.pin !== undefined) updateData.pin = hashPin(body.pin); // Hash PIN on update
    if (body.role !== undefined) updateData.role = body.role;
    if (body.hourlyWage !== undefined) updateData.hourlyWage = Number(body.hourlyWage);
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.email !== undefined) updateData.email = body.email ? sanitizeString(body.email) : null;
    if (body.phone !== undefined) updateData.phone = body.phone ? sanitizeString(body.phone) : null;

    const employee = await db.employee.update({ where: { id }, data: updateData });

    // Remove PIN from response
    const { pin: _pin, ...safeEmployee } = employee;
    return NextResponse.json({ employee: safeEmployee });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.employee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
