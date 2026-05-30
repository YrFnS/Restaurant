export interface StaffSession {
  id: string;
  name: string;
  role: string;
}

export function encodeSession(session: StaffSession): string {
  // Use btoa for browser compatibility (Buffer is Node-only)
  return typeof window !== 'undefined'
    ? btoa(JSON.stringify(session))
    : Buffer.from(JSON.stringify(session)).toString('base64');
}

export function decodeSession(encoded: string): StaffSession | null {
  try {
    // Decode URL encoding first (cookies are URL-encoded)
    const urlDecoded = decodeURIComponent(encoded);
    // Use atob for browser compatibility (Buffer is Node-only)
    const json = typeof window !== 'undefined'
      ? atob(urlDecoded)
      : Buffer.from(urlDecoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string' && typeof parsed.role === 'string') {
      return parsed as StaffSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'manager';
}

export function isStaffRole(role: string): boolean {
  return role === 'admin' || role === 'manager' || role === 'staff';
}
