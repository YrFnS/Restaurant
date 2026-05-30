import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { sanitizeString } from '@/lib/sanitize';

const ALLOWED_FIELDS = ['type', 'amount', 'note', 'createdBy'] as const;

function validateCashInput(body: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for disallowed fields
  const extraFields = Object.keys(body).filter(k => !ALLOWED_FIELDS.includes(k as typeof ALLOWED_FIELDS[number]));
  if (extraFields.length > 0) {
    errors.push(`Fields not allowed: ${extraFields.join(', ')}`);
  }

  // Validate type
  if (body.type !== undefined) {
    if (!['payin', 'sale', 'payout', 'drop'].includes(body.type as string)) {
      errors.push('Type must be payin, sale, payout, or drop');
    }
  }

  // Validate amount
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (isNaN(amount) || amount <= 0 || amount > 1000000) {
      errors.push('Amount must be positive and at most 1,000,000');
    }
  }

  // Validate note
  if (body.note !== undefined && body.note !== null && body.note !== '') {
    if (typeof body.note !== 'string' || body.note.length > 1000) {
      errors.push('Note must be at most 1000 characters');
    }
  }

  // Validate createdBy
  if (body.createdBy !== undefined && body.createdBy !== null && body.createdBy !== '') {
    if (typeof body.createdBy !== 'string' || body.createdBy.length > 255) {
      errors.push('CreatedBy must be at most 255 characters');
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function GET() {
  try {
    const entries = await db.cashDrawerEntry.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching cash entries:', error);
    return NextResponse.json({ error: 'Failed to fetch cash entries' }, { status: 500 });
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
    const { valid, errors } = validateCashInput(body);
    if (!valid) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const { type, amount, note, createdBy } = body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 });
    }

    const entry = await db.cashDrawerEntry.create({
      data: {
        type: type || 'payin',
        amount: numAmount,
        note: note ? sanitizeString(note) : null,
        createdBy: createdBy ? sanitizeString(createdBy) : null,
      },
    });
    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error creating cash entry:', error);
    return NextResponse.json({ error: 'Failed to create cash entry' }, { status: 500 });
  }
}
