import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const combos = await db.comboMeal.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ combos });
  } catch (error) {
    console.error('Error fetching combo meals:', error);
    return NextResponse.json({ error: 'Failed to fetch combo meals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const combo = await db.comboMeal.create({
      data: {
        nameEn: data.nameEn || data.name || '',
        nameAr: data.nameAr || null,
        descriptionEn: data.descriptionEn || data.description || null,
        descriptionAr: data.descriptionAr || null,
        price: data.price || 0,
        items: data.items ? JSON.stringify(data.items) : null,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    return NextResponse.json({ combo });
  } catch (error) {
    console.error('Error creating combo meal:', error);
    return NextResponse.json({ error: 'Failed to create combo meal' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const combo = await db.comboMeal.update({
      where: { id },
      data: {
        ...updateData,
        items: updateData.items ? JSON.stringify(updateData.items) : undefined,
      },
    });
    return NextResponse.json({ combo });
  } catch (error) {
    console.error('Error updating combo meal:', error);
    return NextResponse.json({ error: 'Failed to update combo meal' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await db.comboMeal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting combo meal:', error);
    return NextResponse.json({ error: 'Failed to delete combo meal' }, { status: 500 });
  }
}
