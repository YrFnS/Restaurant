import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sanitizeString } from '@/lib/sanitize';

const ALLOWED_FIELDS = ['name', 'unit', 'quantity', 'lowThreshold', 'costPerUnit', 'supplier', 'category'] as const;

function validateIngredientInput(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
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

  // Validate unit
  if (body.unit !== undefined) {
    if (typeof body.unit !== 'string' || body.unit.length > 50) {
      errors.push('Unit must be a string of at most 50 characters');
    }
  }

  // Validate quantity
  if (body.quantity !== undefined) {
    const qty = Number(body.quantity);
    if (isNaN(qty) || qty < 0 || qty > 1000000) {
      errors.push('Quantity must be between 0 and 1,000,000');
    }
  }

  // Validate lowThreshold
  if (body.lowThreshold !== undefined) {
    const threshold = Number(body.lowThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1000000) {
      errors.push('Low threshold must be between 0 and 1,000,000');
    }
  }

  // Validate costPerUnit
  if (body.costPerUnit !== undefined) {
    const cost = Number(body.costPerUnit);
    if (isNaN(cost) || cost < 0 || cost > 100000) {
      errors.push('Cost per unit must be between 0 and 100,000');
    }
  }

  // Validate supplier
  if (body.supplier !== undefined && body.supplier !== null && body.supplier !== '') {
    if (typeof body.supplier !== 'string' || body.supplier.length > 255) {
      errors.push('Supplier must be at most 255 characters');
    }
  }

  // Validate category
  if (body.category !== undefined && body.category !== null && body.category !== '') {
    if (typeof body.category !== 'string' || body.category.length > 255) {
      errors.push('Category must be at most 255 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function GET() {
  try {
    const ingredients = await db.ingredient.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({ ingredients });
  } catch (error) {
    console.error('Error fetching ingredients:', error);
    return NextResponse.json({ error: 'Failed to fetch ingredients' }, { status: 500 });
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
    const { valid, errors } = validateIngredientInput(body);
    if (!valid) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const { name, unit, quantity, lowThreshold, costPerUnit, supplier, category } = body;
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const ingredient = await db.ingredient.create({
      data: {
        name: sanitizeString(name),
        unit: unit ? sanitizeString(unit) : 'pcs',
        quantity: Number(quantity) || 0,
        lowThreshold: Number(lowThreshold) || 10,
        costPerUnit: Number(costPerUnit) || 0,
        supplier: supplier ? sanitizeString(supplier) : null,
        category: category ? sanitizeString(category) : null,
      },
    });
    return NextResponse.json({ ingredient });
  } catch (error) {
    console.error('Error creating ingredient:', error);
    return NextResponse.json({ error: 'Failed to create ingredient' }, { status: 500 });
  }
}
