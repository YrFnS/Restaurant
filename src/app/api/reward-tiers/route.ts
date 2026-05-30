import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rewardTiers = await db.rewardTier.findMany({
      where: { isActive: true },
      orderBy: { points: 'asc' },
    });
    return NextResponse.json({ rewardTiers });
  } catch (error) {
    console.error('Error fetching reward tiers:', error);
    return NextResponse.json({ rewardTiers: [] }, { status: 500 });
  }
}
