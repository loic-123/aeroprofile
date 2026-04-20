import type { HTMLAttributes, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";

interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Disables the fade-in-on-mount animation (use for above-the-fold). */
  noAnimate?: boolean;
  children?: ReactNode;
}

/**
 * Top-level page section with an optional title + description row and
 * a fade-in-up animation on mount. The animation respects
 * prefers-reduced-motion (disabled globally in index.css).
 */
export function Section({
  title,
  description,
  action,
  noAnimate,
  className,
  children,
  ...rest
}: SectionProps) {
  const content = (
    <>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold">{title}</h3>}
            {description && (
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </>
  );

  if (noAnimate) {
    return (
      <section className={cn("space-y-3", className)} {...rest}>
        {content}
      </section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className={cn("space-y-3", className)}
      {...(rest as React.ComponentProps<typeof motion.section>)}
    >
      {content}
    </motion.section>
  );
}
