import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, isAdminRole, isStaffRole } from '@/lib/auth';

// Public API routes that don't require authentication (exact match or prefix match)
const PUBLIC_API_ROUTES = [
  '/api/menu',
  '/api/offers',
  '/api/testimonials',
  '/api/promo',
  '/api/promo-codes',
  '/api/newsletter',
  '/api/reward-tiers',
];

// Public API routes that should ONLY match exact path (not sub-paths)
const PUBLIC_EXACT_ROUTES = [
  '/api/settings',  // /api/settings is public, but /api/settings/combos is admin
];

// Staff routes require staff session (admin/manager/staff)
const STAFF_API_ROUTES = [
  '/api/orders',
  '/api/kitchen',
  '/api/kitchen-screens',
  '/api/stations',
  '/api/orders/items',
  '/api/customers',
  '/api/gift-cards',
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
  '/api/settings/combos',
  '/api/settings/dynamic-pricing',
];

// Routes where specific methods are public but others require auth (customer-facing)
const METHOD_RESTRICTED_ROUTES: Record<string, { publicMethods: string[]; requiredRole: 'staff' | 'admin' }> = {
  '/api/reservations': { publicMethods: ['POST'], requiredRole: 'staff' },
  '/api/waitlist': { publicMethods: ['POST'], requiredRole: 'staff' },
  '/api/feedback': { publicMethods: ['POST'], requiredRole: 'admin' },
};

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

function matchesExact(pathname: string, routes: string[]): boolean {
  return routes.some(route => pathname === route);
}

function requireAuth(request: NextRequest, roleCheck: 'admin' | 'staff'): NextResponse | null {
  const session = getStaffSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (roleCheck === 'admin' && !isAdminRole(session.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  if (roleCheck === 'staff' && !isStaffRole(session.role)) {
    return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
  }
  return null; // Auth passed
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
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

  // Seed route - admin only (check early before public route matching)
  if (pathname === SEED_ROUTE) {
    const authError = requireAuth(request, 'admin');
    if (authError) {
      if (getStaffSession(request) === null) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Admin routes - require admin/manager (check BEFORE public routes)
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

  // Staff routes - require any staff role (check BEFORE public routes)
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

  // Handle method-restricted routes (e.g., POST public, GET requires auth)
  for (const [route, config] of Object.entries(METHOD_RESTRICTED_ROUTES)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (config.publicMethods.includes(method)) {
        return NextResponse.next();
      }
      // Non-public method requires auth
      const session = getStaffSession(request);
      if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }
      if (config.requiredRole === 'admin' && !isAdminRole(session.role)) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
      if (config.requiredRole === 'staff' && !isStaffRole(session.role)) {
        return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
      }
      return NextResponse.next();
    }
  }

  // Allow public routes (prefix match)
  if (matchesRoute(pathname, PUBLIC_API_ROUTES)) {
    return NextResponse.next();
  }

  // Allow public exact routes (only exact match, not sub-paths)
  if (matchesExact(pathname, PUBLIC_EXACT_ROUTES)) {
    return NextResponse.next();
  }

  // For any other API route not explicitly listed, allow through
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
