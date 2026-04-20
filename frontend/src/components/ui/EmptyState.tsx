import type { ReactNode } from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Standardised empty-state placeholder for "no data yet" situations.
 * Used on HistoryPage (no analyses), IntervalsPage (not connected),
 * Compare (no riders added).
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "bg-panel border border-border rounded-lg p-8 text-center text-muted flex flex-col items-center gap-3",
        className,
      )}
    >
      {icon && <div className="text-muted-strong">{icon}</div>}
      <div>
        <p className="text-text font-medium">{title}</p>
        {description && <p className="text-sm mt-1">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
