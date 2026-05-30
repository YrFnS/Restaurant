import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/kitchen-screens/[id] - Get a single kitchen screen
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Try to find by ID first, then by slug
    let screen = await db.kitchenScreen.findUnique({ where: { id } });
    if (!screen) {
      screen = await db.kitchenScreen.findUnique({ where: { slug: id } });
    }
    
    if (!screen) {
      return NextResponse.json({ error: 'Screen not found' }, { status: 404 });
    }
    
    return NextResponse.json({ screen });
  } catch (error) {
    console.error('Failed to fetch kitchen screen:', error);
    return NextResponse.json({ error: 'Failed to fetch kitchen screen' }, { status: 500 });
  }
}

// PUT /api/kitchen-screens/[id] - Update a kitchen screen
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Check for duplicate slug if slug is being changed
    if (body.slug) {
      const existing = await db.kitchenScreen.findUnique({ where: { slug: body.slug } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ error: 'A screen with this slug already exists' }, { status: 409 });
      }
    }
    
    const screen = await db.kitchenScreen.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.slug !== undefined && { slug: body.slug }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.stationFilter !== undefined && { stationFilter: body.stationFilter }),
        ...(body.layoutType !== undefined && { layoutType: body.layoutType }),
        ...(body.autoRefreshInterval !== undefined && { autoRefreshInterval: body.autoRefreshInterval }),
        ...(body.showCompleted !== undefined && { showCompleted: body.showCompleted }),
        ...(body.maxOrders !== undefined && { maxOrders: body.maxOrders }),
        ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    
    return NextResponse.json({ screen });
  } catch (error) {
    console.error('Failed to update kitchen screen:', error);
    return NextResponse.json({ error: 'Failed to update kitchen screen' }, { status: 500 });
  }
}

// DELETE /api/kitchen-screens/[id] - Delete a kitchen screen
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.kitchenScreen.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete kitchen screen:', error);
    return NextResponse.json({ error: 'Failed to delete kitchen screen' }, { status: 500 });
  }
}
