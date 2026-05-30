import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sanitizeString } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const trimmedEmail = sanitizeString(email.trim().toLowerCase());

    // Check if already subscribed
    const existing = await db.newsletterSubscription.findUnique({
      where: { email: trimmedEmail },
    });

    if (existing) {
      return NextResponse.json({ message: 'Already subscribed', subscribed: true });
    }

    await db.newsletterSubscription.create({
      data: { email: trimmedEmail },
    });

    return NextResponse.json({ message: 'Subscribed successfully', subscribed: true }, { status: 201 });
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 });
  }
}
