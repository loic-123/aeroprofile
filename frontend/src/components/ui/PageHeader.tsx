import type { ReactNode } from "react";
import { cn } from "./cn";

interface PageHeaderProps {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Consistent page-level header used on HistoryPage, IntervalsPage, Blog
 * index. Puts the title + subtitle on the left and the action buttons
 * on the right with a responsive wrap so the buttons drop below on
 * narrow viewports.
 */
export function PageHeader({ icon, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {icon && <span className="shrink-0 text-primary">{icon}</span>}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
}
