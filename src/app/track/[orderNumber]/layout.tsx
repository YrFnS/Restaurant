import { Suspense, type ReactNode } from "react";

function TrackingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="size-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Loading order tracking…
      </div>
    </div>
  );
}

export default function TrackingLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<TrackingFallback />}>{children}</Suspense>;
}
