'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, LogOut, Loader2 } from 'lucide-react';
import { deleteCookie, getCookie } from '@/lib/cookies';
import { decodeSession, type StaffSession } from '@/lib/auth';

interface StaffLoginProps {
  children: React.ReactNode;
  requiredRole?: 'staff' | 'admin';
}

export function StaffLogin({ children, requiredRole = 'staff' }: StaffLoginProps) {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = () => {
      const cookieValue = getCookie('staff_session');
      if (cookieValue) {
        const decoded = decodeSession(cookieValue);
        if (decoded) {
          setSession(decoded);
        }
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const handleLogin = useCallback(async () => {
    if (pin.length < 4) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        setPin('');
        return;
      }

      // Session cookie is set by the server
      setSession({ id: data.employee.id, name: data.employee.name, role: data.employee.role });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [pin]);

  const handleLogout = useCallback(() => {
    deleteCookie('staff_session');
    setSession(null);
    setPin('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length >= 4) {
      handleLogin();
    }
    if (e.key === 'Backspace') {
      setPin(prev => prev.slice(0, -1));
    }
  }, [pin, handleLogin]);

  // Check role authorization
  const isAuthorized = useCallback((sess: StaffSession) => {
    if (requiredRole === 'admin') {
      return sess.role === 'admin' || sess.role === 'manager';
    }
    // staff role allows admin, manager, and staff
    return sess.role === 'admin' || sess.role === 'manager' || sess.role === 'staff';
  }, [requiredRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="size-8 animate-spin text-amber-500" />
      </div>
    );
  }

  // If logged in and authorized, render children
  if (session && isAuthorized(session)) {
    return (
      <div className="relative">
        {/* Floating session indicator */}
        <div className="fixed bottom-3 right-3 z-[100] flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-amber-500/20 rounded-lg px-3 py-1.5 shadow-lg">
          <Shield className="size-3.5 text-amber-500" />
          <span className="text-xs text-gray-300 font-medium">{session.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold uppercase">{session.role}</span>
          <button
            onClick={handleLogout}
            className="ms-1 p-1 rounded hover:bg-gray-700/50 transition-colors"
            title="Logout"
          >
            <LogOut className="size-3 text-gray-400 hover:text-red-400" />
          </button>
        </div>
        {children}
      </div>
    );
  }

  // If logged in but wrong role
  if (session && !isAuthorized(session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 border border-red-500/20 shadow-2xl text-center">
          <div className="size-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
            <Shield className="size-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-4">
            Your role ({session.role}) does not have access to this area. {requiredRole === 'admin' ? 'Admin or Manager' : 'Staff'} role required.
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
          >
            Try Different Account
          </button>
        </div>
      </div>
    );
  }

  // Login screen
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 border border-amber-500/20 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="size-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Shield className="size-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Staff Login</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your PIN to continue</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`size-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? 'bg-amber-500 border-amber-500 scale-110'
                  : 'bg-transparent border-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) => (
            <button
              key={key || 'empty'}
              disabled={key === ''}
              onClick={() => {
                if (key === '⌫') {
                  setPin(prev => prev.slice(0, -1));
                } else if (pin.length < 6) {
                  setPin(prev => prev + key);
                }
              }}
              className={`h-12 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                key === ''
                  ? 'invisible'
                  : key === '⌫'
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  : 'bg-gray-800 hover:bg-gray-700 text-white'
              }`}
            >
              {key === '⌫' ? '⌫' : key}
            </button>
          ))}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleLogin}
          disabled={pin.length < 4 || submitting}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-base hover:from-amber-600 hover:to-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Verifying...
            </>
          ) : (
            'Login'
          )}
        </button>

        {/* Demo PINs info */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <p className="text-[10px] text-gray-500 text-center mb-2 uppercase tracking-wider">Demo PINs</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs font-mono text-amber-400">1234</div>
              <div className="text-[10px] text-gray-500">Admin</div>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-400">5678</div>
              <div className="text-[10px] text-gray-500">Manager</div>
            </div>
            <div>
              <div className="text-xs font-mono text-amber-400">9999</div>
              <div className="text-[10px] text-gray-500">Staff</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
