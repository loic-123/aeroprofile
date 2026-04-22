import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  children: ReactNode;
  /** Optional right-aligned element (e.g. a 'reset' link or a profile picker). */
  action?: ReactNode;
}

/**
 * Labelled vertical block used to organise the Analyse / Intervals
 * parameter forms. Replaces the dense 2-column grid that confused new
 * users with a guided sequence of sections: each section takes the full
 * width, carries an uppercase label + short description, and stacks
 * child controls vertically with consistent spacing.
 *
 * Not a `<fieldset>` because the inner controls already manage their own
 * labels; a purely visual grouping suits the current markup better.
 */
export function FormSection({ title, description, children, action }: Props) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h4 className="text-[10px] uppercase tracking-widest text-muted font-semibold">
            {title}
          </h4>
          {description && (
            <p className="text-xs text-muted-strong mt-0.5 leading-snug">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
