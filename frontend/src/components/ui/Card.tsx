import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Tone = "default" | "info" | "success" | "warn" | "danger" | "accent";
type Elevation = 0 | 1 | 2 | 3;

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  elevation?: Elevation;
  /** Adds an extra-subtle hover shadow lift. */
  interactive?: boolean;
  children?: ReactNode;
}

const tones: Record<Tone, string> = {
  default: "bg-panel border border-border",
  info: "bg-info-subtle border border-info-border",
  success: "bg-success-subtle border border-success-border",
  warn: "bg-warn-subtle border border-warn-border",
  danger: "bg-danger-subtle border border-danger-border",
  accent: "bg-accent-subtle border border-accent-border",
};

const elevations: Record<Elevation, string> = {
  0: "",
  1: "shadow-e1",
  2: "shadow-e2",
  3: "shadow-e3",
};

/**
 * Primitive card with 6 semantic tones and 4 elevation levels.
 *
 * Tones apply matching tinted background + border so the card visually
 * conveys status (success/warn/danger/info) without needing extra chrome.
 *
 * Elevation adds a subtle shadow + inner light ring for dimensional
 * layering on dark surfaces (see tailwind.config.js boxShadow tokens).
 */
export function Card({
  tone = "default",
  elevation = 1,
  interactive,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg",
        tones[tone],
        elevations[elevation],
        interactive && "transition-shadow duration-base hover:shadow-e2",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action, className, children, ...rest }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 p-4 pb-2", className)} {...rest}>
      {children ?? (
        <>
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </>
      )}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-4 pb-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-4 py-3 border-t border-border/60 text-xs text-muted", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
