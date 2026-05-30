'use client';

import Link from 'next/link';
import { Home, UtensilsCrossed } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function NotFound() {
  const { t, isRTL } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 size-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <UtensilsCrossed className="size-12 text-white" />
        </div>

        {/* 404 Number */}
        <h1 className="text-8xl font-black bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent mb-4">
          404
        </h1>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t.common.notFoundTitle}
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-8 max-w-sm mx-auto">
          {t.common.notFoundDesc}
        </p>

        {/* Home Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-base hover:from-amber-600 hover:to-orange-700 transition-all active:scale-[0.98] shadow-lg shadow-amber-500/25"
        >
          <Home className="size-5" />
          {t.common.backToHome}
        </Link>
      </div>
    </div>
  );
}
