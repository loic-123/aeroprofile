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
   *  instance on the page (otherwise the highlight will animate
   *  between them on selection). */
  layoutId?: string;
  /** aria-label for the wrapping <nav> element. */
  ariaLabel?: string;
  /** When true, labels are hidden below sm breakpoint and only the
   *  icon is shown. The label still exists in the DOM (for a11y) via
   *  a sr-only span. */
  iconOnlyOnMobile?: boolean;
}

/**
 * Editorial segmented-control: instead of a filled pill behind the
 * active tab, a single 1-pixel copper hairline sits at the bottom
 * edge and slides to the clicked tab. More restrained than the
 * filled-pill pattern and reads as "editorial tab" rather than "SaaS
 * tab button group". Framer-motion `layoutId` makes the hairline
 * tween smoothly between positions.
 *
 * Keyboard: native <button> semantics + the global focus-visible
 * copper ring.
 */
export function NavTabs<V extends string>({
  items,
  value,
  onChange,
  className,
  layoutId = "nav-tabs-highlight",
  ariaLabel = "Navigation",
  iconOnlyOnMobile = false,
}: NavTabsProps<V>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("inline-flex relative gap-1", className)}
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
                "relative px-3 py-2 text-sm flex items-center gap-2 transition-colors duration-base",
                // The pill is gone — the active state is purely a
                // text color change + the sliding hairline below.
                active
                  ? "text-text"
                  : "text-muted hover:text-muted-strong",
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                {item.icon}
                <span className={iconOnlyOnMobile ? "hidden sm:inline" : undefined}>
                  {item.label}
                </span>
                {iconOnlyOnMobile && (
                  <span className="sr-only sm:hidden">{item.label}</span>
                )}
              </span>
              {active && (
                <motion.span
                  layoutId={`${layoutId}-hairline`}
                  className="absolute left-2 right-2 bottom-0 h-px bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </LayoutGroup>
    </nav>
  );
}
