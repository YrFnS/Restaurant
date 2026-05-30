import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const rules = await db.dynamicPricing.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ rules });
  } catch (error) {
    console.error('Error fetching dynamic pricing:', error);
    return NextResponse.json({ error: 'Failed to fetch dynamic pricing rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const rule = await db.dynamicPricing.create({
      data: {
        nameEn: data.nameEn || data.name || '',
        nameAr: data.nameAr || null,
        type: data.type || 'happy_hour',
        multiplier: data.multiplier ?? (data.discountPercent ? (100 - data.discountPercent) / 100 : 1.0),
        dayOfWeek: data.dayOfWeek ?? null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        isActive: data.isActive ?? true,
      },
    });
    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error creating dynamic pricing rule:', error);
    return NextResponse.json({ error: 'Failed to create dynamic pricing rule' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const rule = await db.dynamicPricing.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ rule });
  } catch (error) {
    console.error('Error updating dynamic pricing rule:', error);
    return NextResponse.json({ error: 'Failed to update dynamic pricing rule' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await db.dynamicPricing.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dynamic pricing rule:', error);
    return NextResponse.json({ error: 'Failed to delete dynamic pricing rule' }, { status: 500 });
  }
}
