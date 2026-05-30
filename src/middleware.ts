import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, isAdminRole, isStaffRole } from '@/lib/auth';

// Public API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/menu',
  '/api/settings',
  '/api/offers',
  '/api/testimonials',
  '/api/promo',
  '/api/promo-codes',
  '/api/newsletter',
];

// Staff routes require staff session (admin/manager/staff)
const STAFF_API_ROUTES = [
  '/api/orders',
  '/api/kitchen',
  '/api/kitchen-screens',
  '/api/stations',
  '/api/orders/items',
];

// Admin routes require admin/manager role
const ADMIN_API_ROUTES = [
  '/api/employees',
  '/api/inventory',
  '/api/cash',
  '/api/schedules',
  '/api/reports',
  '/api/notifications',
  '/api/tables',
  '/api/reward-tiers',
  '/api/settings/combos',
  '/api/settings/dynamic-pricing',
];

// Seed route requires admin role only
const SEED_ROUTE = '/api/seed';

function getStaffSession(request: NextRequest): { id: string; name: string; role: string } | null {
  const cookieValue = request.cookies.get('staff_session')?.value;
  if (!cookieValue) return null;
  return decodeSession(cookieValue);
}

function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => pathname === route || pathname.startsWith(route + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
    return NextResponse.next();
  }

  // Allow feedback POST (public for customers)
  if (pathname === '/api/feedback' && request.method === 'POST') {
    return NextResponse.next();
  }

  // Allow auth route (login endpoint)
  if (pathname === '/api/auth') {
    return NextResponse.next();
  }

  // Allow AI recommend (public for customers)
  if (pathname === '/api/ai-recommend') {
    return NextResponse.next();
  }

  // Seed route - admin only
  if (pathname === SEED_ROUTE) {
    const session = getStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Admin routes - require admin/manager
  if (matchesRoute(pathname, ADMIN_API_ROUTES)) {
    const session = getStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isAdminRole(session.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Staff routes - require any staff role
  if (matchesRoute(pathname, STAFF_API_ROUTES)) {
    const session = getStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!isStaffRole(session.role)) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // For any other API route not explicitly listed, allow through
  // (e.g., /api/customers, /api/reservations, /api/waitlist, etc.)
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
