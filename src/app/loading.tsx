import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-10 animate-spin text-amber-600" />
        <p className="text-sm font-medium text-amber-700">Loading...</p>
      </div>
    </div>
  );
}
