import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = i18n.language?.startsWith("fr") ? "fr" : "en";
  const next = current === "fr" ? "en" : "fr";

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(next)}
      aria-label={t("language.toggle")}
      title={next === "fr" ? t("language.fr") : t("language.en")}
      className="p-2 rounded text-muted hover:text-text hover:bg-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider"
    >
      <Languages size={14} aria-hidden />
      {current}
    </button>
  );
}
