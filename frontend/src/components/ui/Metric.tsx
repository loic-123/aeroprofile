import type { ReactNode } from "react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg" | "xl";
type Tone = "neutral" | "primary" | "accent" | "info" | "success" | "warn" | "danger";

interface MetricProps {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  size?: Size;
  tone?: Tone;
  className?: string;
}

const valueSizes: Record<Size, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-5xl",
};

const tones: Record<Tone, string> = {
  neutral: "text-text",
  primary: "text-primary",
  accent: "text-accent",
  info: "text-info",
  success: "text-success",
  warn: "text-warn",
  danger: "text-danger",
};

/**
 * Canonical metric display. The label is small + muted, the value is
 * the hero (mono font, tabular nums), and an optional unit suffix + sub
 * caption complete the block. Four sizes to match the importance of
 * the metric (xl = CdA hero, lg = primary metrics, md = secondary, sm
 * = inline badges).
 */
export function Metric({ label, value, unit, sub, size = "md", tone = "neutral", className }: MetricProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="text-xs uppercase tracking-wide text-muted font-medium">{label}</div>
      <div className={cn("num font-bold leading-none flex items-baseline gap-1", valueSizes[size], tones[tone])}>
        <span>{value}</span>
        {unit && <span className="text-muted text-sm font-normal">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
