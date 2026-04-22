import { Github, Mail, BookOpen, User, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Props {
  onGotoMethods: () => void;
  onGotoAbout: () => void;
  onGotoPrivacy?: () => void;
}

export function Footer({ onGotoMethods, onGotoAbout, onGotoPrivacy }: Props) {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border/60 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-[1fr,auto] gap-8 md:gap-12">
        <div className="space-y-3">
          <div className="text-sm text-text font-semibold">
            {t("footer.brand")}
          </div>
          <p className="text-xs text-muted-strong leading-relaxed max-w-md">
            {t("footer.tagline")}
          </p>
          <div className="text-[10px] text-muted font-mono pt-2">
            {t("footer.version")}
          </div>
        </div>

        <nav className="flex flex-wrap gap-6 text-sm" aria-label={t("footer.nav")}>
          <a
            href="https://github.com/loic-123/aeroprofile"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
          >
            <Github size={14} aria-hidden />
            GitHub
          </a>
          <button
            onClick={onGotoMethods}
            className="inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
          >
            <BookOpen size={14} aria-hidden />
            {t("footer.methods")}
          </button>
          <button
            onClick={onGotoAbout}
            className="inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
          >
            <User size={14} aria-hidden />
            {t("footer.about")}
          </button>
          {onGotoPrivacy && (
            <button
              onClick={onGotoPrivacy}
              className="inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
            >
              <Shield size={14} aria-hidden />
              {t("footer.privacy")}
            </button>
          )}
          <a
            href="mailto:loic.bouxirot@gmail.com"
            className="inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
          >
            <Mail size={14} aria-hidden />
            Email
          </a>
        </nav>
      </div>
    </footer>
  );
}
