'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 p-4">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 size-24 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <AlertTriangle className="size-12 text-white" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Something Went Wrong
        </h2>

        {/* Message */}
        <p className="text-gray-600 mb-2">
          An unexpected error occurred. Please try again.
        </p>

        {/* Error details in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
            <p className="text-sm text-red-700 font-mono break-words">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-1">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Try Again Button */}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold text-base hover:from-amber-600 hover:to-orange-700 transition-all active:scale-[0.98] shadow-lg shadow-amber-500/25"
        >
          <RefreshCw className="size-5" />
          Try Again
        </button>
      </div>
    </div>
  );
}
