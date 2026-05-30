'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function KitchenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 border border-amber-500/20 shadow-2xl text-center">
        {/* Icon */}
        <div className="size-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="size-8 text-red-500" />
        </div>

        {/* Heading */}
        <h2 className="text-xl font-bold text-white mb-2">
          Kitchen Display Error
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-sm mb-4">
          The kitchen display encountered an error. Please try again to restore order tracking.
        </p>

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-start">
            <p className="text-sm text-red-400 font-mono break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500/70 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Try Again Button */}
        <button
          onClick={reset}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-base hover:from-amber-600 hover:to-orange-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <RefreshCw className="size-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
