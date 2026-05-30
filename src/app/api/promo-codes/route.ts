import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const promoCodes = await db.promoCode.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Filter out expired codes
    const validCodes = promoCodes.filter((code) => {
      if (code.validUntil && new Date(code.validUntil) < now) return false;
      if (code.validFrom && new Date(code.validFrom) > now) return false;
      return true;
    });

    return NextResponse.json({ promoCodes: validCodes });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json({ promoCodes: [] }, { status: 500 });
  }
}
