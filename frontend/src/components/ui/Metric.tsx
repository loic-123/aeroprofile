import type { ReactNode } from "react";
import { cn } from "./cn";
import { HairlineUnderline } from "./HairlineUnderline";

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
  /** Render a copper hairline under the value. Makes the metric feel
   *  editorial — reserved for hero or highlighted figures, not
   *  every stat in a grid. */
  underline?: boolean;
  /** When true, the label is rendered as a serif italic eyebrow
   *  (reserved for large metric sizes ≥ lg). Otherwise the regular
   *  uppercase tracking-wide label is used. */
  eyebrowStyle?: "plain" | "serif";
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
 * Canonical metric display. Label above, big mono number below,
 * optional unit + sub caption. Four sizes; tone picks the colour of
 * the value (copper for primary, etc.).
 *
 * Set `eyebrowStyle="serif"` to render the label as a copper italic
 * serif eyebrow — the editorial signature of the rebrand. Strict
 * rule: only use serif eyebrows with `size="lg"` or `"xl"`, since
 * Instrument Serif italic gets spindly below 24px.
 *
 * Set `underline` to draw an animated copper hairline under the
 * value. Reserved for hero / highlighted figures.
 */
export function Metric({
  label,
  value,
  unit,
  sub,
  size = "md",
  tone = "neutral",
  className,
  underline,
  eyebrowStyle = "plain",
}: MetricProps) {
  const useSerif = eyebrowStyle === "serif" && (size === "lg" || size === "xl");
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className={cn(
          useSerif
            ? "font-serif italic text-lg text-primary/90 leading-none"
            : "text-[11px] uppercase tracking-widest text-muted font-medium leading-none",
        )}
      >
        {label}
      </div>
      <div className="relative inline-block">
        <div
          className={cn(
            "num font-semibold leading-none flex items-baseline gap-1.5",
            valueSizes[size],
            tones[tone],
          )}
        >
          <span>{value}</span>
          {unit && <span className="text-muted text-sm font-normal">{unit}</span>}
        </div>
        {underline && (
          <HairlineUnderline className="mt-1.5" />
        )}
      </div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}
