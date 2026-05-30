import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const notifications = await db.notification.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (body.markAll) {
      await db.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    } else if (body.id) {
      await db.notification.update({ where: { id: body.id }, data: { isRead: true } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, title, message } = body;
    if (!title || !message) return NextResponse.json({ error: 'Title and message required' }, { status: 400 });
    const notification = await db.notification.create({
      data: { type: type || 'info', title, message },
    });
    return NextResponse.json({ notification });
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
