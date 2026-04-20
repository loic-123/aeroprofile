import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Tone =
  | "neutral"
  | "primary"
  | "accent"
  | "info"
  | "success"
  | "warn"
  | "danger";
type Size = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: Size;
  /** Render the dot prefix (◉) as a status indicator. */
  dot?: boolean;
  children?: ReactNode;
}

const tones: Record<Tone, string> = {
  neutral: "bg-panel-2 text-muted-strong border-border",
  primary: "bg-primary-subtle text-primary border-primary-border",
  accent: "bg-accent-subtle text-accent border-accent-border",
  info: "bg-info-subtle text-info border-info-border",
  success: "bg-success-subtle text-success border-success-border",
  warn: "bg-warn-subtle text-warn border-warn-border",
  danger: "bg-danger-subtle text-danger border-danger-border",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-muted",
  primary: "bg-primary",
  accent: "bg-accent",
  info: "bg-info",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
};

const sizes: Record<Size, string> = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-0.5 gap-1.5",
};

/**
 * Tiny labelled pill used for quality statuses, sensor labels, feature
 * chips, and any inline status indicator. Seven semantic tones match
 * the Card component's tones so a card + badge combo always reads
 * consistently.
 */
export function Badge({
  tone = "neutral",
  size = "md",
  dot,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded border",
        tones[tone],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {dot && (
        <span className={cn("inline-block rounded-full w-1.5 h-1.5", dotTones[tone])} aria-hidden />
      )}
      {children}
    </span>
  );
}
