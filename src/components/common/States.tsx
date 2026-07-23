import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shimmer block used while the book is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-muted", className)} />;
}

/**
 * Error state. The dashboard never substitutes invented numbers for a failed
 * fetch — an empty panel is honest, a plausible fake one is not.
 */
export function ErrorState({
  error,
  onRetry,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive",
        compact ? "p-3" : "p-5",
      )}
      role="alert"
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold">Couldn't load portfolio data</p>
        <p className="text-[11.5px] mt-1 opacity-80 break-words">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium rounded-md border border-destructive/30 px-2.5 py-1 hover:bg-destructive/10 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  message,
  hint,
  className,
}: {
  message: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2.5 py-12 text-center",
        className,
      )}
    >
      <Inbox className="h-7 w-7 text-muted-foreground/30" />
      <p className="text-[13px] text-muted-foreground">{message}</p>
      {hint && <p className="text-[11.5px] text-muted-foreground/70 max-w-sm">{hint}</p>}
    </div>
  );
}

/**
 * Wraps a panel body so every widget handles the three non-happy states the
 * same way. Keeps the load/error/empty logic out of each chart.
 */
export function Panel({
  isLoading,
  error,
  isEmpty,
  onRetry,
  skeleton,
  emptyMessage = "No holdings match this view.",
  emptyHint,
  children,
}: {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  emptyMessage?: string;
  emptyHint?: string;
  children: React.ReactNode;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} compact />;
  if (isLoading) return <>{skeleton ?? <Skeleton className="h-40 w-full" />}</>;
  if (isEmpty) return <EmptyState message={emptyMessage} hint={emptyHint} />;
  return <>{children}</>;
}
