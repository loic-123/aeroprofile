import { motion, LayoutGroup } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "./cn";

export interface NavTabItem<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
}

interface NavTabsProps<V extends string> {
  items: NavTabItem<V>[];
  value: V;
  onChange: (v: V) => void;
  className?: string;
  /** An id used as the layoutId namespace — must be unique per NavTabs
   *  instance on the page (otherwise the highlight pill will animate
   *  between them on selection). */
  layoutId?: string;
  /** aria-label for the wrapping <nav> element. */
  ariaLabel?: string;
}

/**
 * A segmented control with a smoothly animated active-tab highlight.
 * The highlight uses framer-motion's `layoutId` so it slides from
 * the previous active tab to the new one instead of snapping. Clicks
 * on the current tab are no-ops so we don't over-trigger state.
 *
 * Keyboard: native button elements + visible focus ring via the
 * global focus-visible style. Tab navigates through items, Enter /
 * Space activates.
 */
export function NavTabs<V extends string>({
  items,
  value,
  onChange,
  className,
  layoutId = "nav-tabs-highlight",
  ariaLabel = "Navigation",
}: NavTabsProps<V>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "inline-flex bg-panel border border-border rounded-lg p-1 relative",
        className,
      )}
    >
      <LayoutGroup id={layoutId}>
        {items.map((item) => {
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (!active) onChange(item.value);
              }}
              className={cn(
                "relative px-3 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors duration-base",
                active ? "text-primary-fg" : "text-muted hover:text-text",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${layoutId}-pill`}
                  className="absolute inset-0 bg-primary rounded-md -z-0"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  aria-hidden
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {item.icon}
                {item.label}
              </span>
            </button>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
