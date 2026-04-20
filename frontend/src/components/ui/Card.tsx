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
 * Editorial rebrand: default cards use a 2px radius (quiet, paper-
 * like) while interactive or tinted cards keep the softer 6px lg
 * radius. Tones apply tinted background + border to convey status
 * without extra chrome. Elevation adds a subtle shadow + inner warm
 * light ring for dimensional layering on the warm near-black bg.
 */
export function Card({
  tone = "default",
  elevation = 1,
  interactive,
  className,
  children,
  ...rest
}: CardProps) {
  // Default tone gets the editorial 2-pixel radius (the "newspaper
  // sidebar" feel); any status tone keeps the softer 6-pixel radius
  // so the tinted fill doesn't look like a hard banner.
  const radius = tone === "default" ? "rounded" : "rounded-lg";
  return (
    <div
      className={cn(
        radius,
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
