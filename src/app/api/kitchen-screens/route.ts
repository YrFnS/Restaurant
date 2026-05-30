import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/kitchen-screens - List all kitchen screens
export async function GET() {
  try {
    const screens = await db.kitchenScreen.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ screens });
  } catch (error) {
    console.error('Failed to fetch kitchen screens:', error);
    return NextResponse.json({ error: 'Failed to fetch kitchen screens' }, { status: 500 });
  }
}

// POST /api/kitchen-screens - Create a new kitchen screen
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      slug,
      description,
      stationFilter,
      layoutType,
      autoRefreshInterval,
      showCompleted,
      maxOrders,
      sortOrder,
      isActive,
    } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Check for duplicate slug
    const existing = await db.kitchenScreen.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'A screen with this slug already exists' }, { status: 409 });
    }

    const screen = await db.kitchenScreen.create({
      data: {
        name,
        slug,
        description: description || '',
        stationFilter: stationFilter || '',
        layoutType: layoutType || 'grid',
        autoRefreshInterval: autoRefreshInterval ?? 10,
        showCompleted: showCompleted ?? false,
        maxOrders: maxOrders ?? 0,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });

    return NextResponse.json({ screen }, { status: 201 });
  } catch (error) {
    console.error('Failed to create kitchen screen:', error);
    return NextResponse.json({ error: 'Failed to create kitchen screen' }, { status: 500 });
  }
}
