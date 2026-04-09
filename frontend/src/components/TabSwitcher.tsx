/**
 * Simple two-tab switcher used inside analysis modes to separate
 * the aggregate overview from the per-ride detail view.
 */

interface Props {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabSwitcher({ tabs, active, onChange }: Props) {
  return (
    <div className="flex border-b border-border mb-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
            active === t.id
              ? "border-teal text-teal"
              : "border-transparent text-muted hover:text-text"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
