import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.hold !== undefined) updateData.hold = body.hold;
    if (body.seatNumber !== undefined) updateData.seatNumber = body.seatNumber;

    const item = await db.orderItem.update({
      where: { id },
      data: updateData,
    });

    // Check if all items in the order are ready/served - if so, update order status
    if (body.status === 'ready') {
      const order = await db.order.findUnique({
        where: { id: item.orderId },
        include: { items: true },
      });
      if (order) {
        const allReady = order.items
          .filter((i) => i.status !== 'cancelled')
          .every((i) => ['ready', 'served'].includes(i.status));
        if (allReady) {
          await db.order.update({
            where: { id: order.id },
            data: { status: 'ready' },
          });
        }
      }
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('Error updating order item:', error);
    return NextResponse.json({ error: 'Failed to update order item' }, { status: 500 });
  }
}
