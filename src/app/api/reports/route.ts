import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';

    // Get order stats
    const totalOrders = await db.order.count();
    const completedOrders = await db.order.count({ where: { status: 'completed' } });
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayOrders = await db.order.findMany({
      where: { createdAt: { gte: todayStart } },
      include: { items: true },
    });

    const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
    const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;

    return NextResponse.json({
      type,
      totalOrders,
      completedOrders,
      todayOrders: todayOrders.length,
      todayRevenue,
      avgOrderValue,
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
