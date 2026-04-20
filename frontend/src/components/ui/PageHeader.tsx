import type { ReactNode } from "react";
import { cn } from "./cn";

interface PageHeaderProps {
  /** Optional icon rendered next to the eyebrow. Kept small — this
   *  is an editorial eyebrow, not a tile icon. */
  icon?: ReactNode;
  /** Small italic-serif line above the title. If omitted, the old
   *  single-title behaviour is preserved. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Editorial page header: copper italic-serif eyebrow above a large
 * sans-serif title, subtitle muted below, actions right. The serif
 * eyebrow is the single most visible typography signal of the
 * rebrand — every page that uses PageHeader now reads as a chapter
 * in a publication rather than a dashboard tab.
 *
 * When `eyebrow` is not supplied, the previous compact layout
 * (icon + title on one row) is preserved for backward compat.
 */
export function PageHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: PageHeaderProps) {
  // Derive a default eyebrow from the icon if the caller passed an
  // icon but no eyebrow — the old convention used the icon as the
  // only decoration. If neither are provided we fall through to the
  // plain title.
  const showEyebrow = eyebrow !== undefined || icon !== undefined;
  const eyebrowContent = eyebrow !== undefined ? eyebrow : null;

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 flex-wrap pb-4 border-b border-border/70",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {showEyebrow && (
          <div className="flex items-center gap-2 text-primary/90 font-serif italic text-lg md:text-xl leading-none">
            {icon && <span className="shrink-0">{icon}</span>}
            {eyebrowContent}
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight truncate">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap shrink-0 pt-1">
          {actions}
        </div>
      )}
    </div>
  );
}
