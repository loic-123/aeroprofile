import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-base select-none " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-fg hover:bg-primary-hover focus-visible:ring-primary",
  secondary:
    "bg-panel border border-border text-text hover:border-border-strong hover:bg-panel-2 focus-visible:ring-primary",
  ghost:
    "text-muted hover:text-text hover:bg-panel focus-visible:ring-primary",
  danger:
    "bg-danger text-danger-fg hover:bg-danger-hover focus-visible:ring-danger",
  subtle:
    "bg-primary-subtle text-primary border border-primary-border hover:bg-primary/20 focus-visible:ring-primary",
};

const sizes: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 h-7",
  md: "text-sm px-3.5 py-2 h-9",
  lg: "text-base px-5 py-2.5 h-11",
  icon: "h-9 w-9 p-0",
};

/**
 * Primitive button with 5 visual variants and 4 sizes.
 *
 * - Uses framer-motion for the press/hover micro-animation. Respects
 *   `prefers-reduced-motion` via the global CSS rule in index.css.
 * - Includes a loading state that swaps the left icon for a spinner
 *   and disables the button.
 * - All buttons have a visible focus ring for keyboard navigation.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(base, variants[variant], sizes[size], className)}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <Loader2 className="animate-spin shrink-0" size={size === "sm" ? 14 : size === "lg" ? 18 : 16} />
      ) : (
        leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
      )}
      {children && <span className={size === "icon" ? "sr-only" : undefined}>{children}</span>}
      {!loading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </motion.button>
  );
});
