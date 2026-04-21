import { Github, Mail, BookOpen, User } from "lucide-react";

interface Props {
  onGotoMethods: () => void;
  onGotoAbout: () => void;
}

/**
 * Global footer — previously nonexistent. Surfaces the three things
 * a prospective user needs to trust the project: open-source license,
 * the person behind it, and a channel to report bugs. Data-privacy
 * disclaimer ("stays in your browser") reassures cold traffic.
 */
export function Footer({ onGotoMethods, onGotoAbout }: Props) {
  return (
    <footer className="border-t border-border/60 mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-[1fr,auto] gap-8 md:gap-12">
        <div className="space-y-3">
          <div className="text-sm text-text font-semibold">
            AeroProfile
          </div>
          <p className="text-xs text-muted-strong leading-relaxed max-w-md">
            Open-source CdA estimator for cyclists. Built by Loïc Bouxirot.
            MIT licensed. Your ride data stays in your browser — nothing
            is stored on any server.
          </p>
          <div className="text-[10px] text-muted font-mono pt-2">
            v2026.04 · made in France
          </div>
        </div>

        <nav className="flex flex-wrap gap-6 text-sm" aria-label="Footer">
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
            Methods
          </button>
          <button
            onClick={onGotoAbout}
            className="inline-flex items-center gap-1.5 text-muted hover:text-text transition-colors"
          >
            <User size={14} aria-hidden />
            About
          </button>
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
