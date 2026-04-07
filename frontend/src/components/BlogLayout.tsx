import { useState, type ReactNode } from "react";
import { Wind, ArrowLeft } from "lucide-react";

/**
 * Simple client-side "routing" for the blog. No react-router needed —
 * we just track which slug is active in App state passed via context.
 */
interface BlogContextType {
  slug: string | null;
  go: (slug: string | null) => void;
}

let _blogCtx: BlogContextType = { slug: null, go: () => {} };

export function useBlog() {
  return _blogCtx;
}

export function BlogProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: BlogContextType;
}) {
  _blogCtx = value;
  return <>{children}</>;
}

export function Link({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  return (
    <div onClick={() => _blogCtx.go(slug)} className="cursor-pointer">
      {children}
    </div>
  );
}

export function BackToIndex() {
  return (
    <button
      onClick={() => _blogCtx.go(null)}
      className="flex items-center gap-2 text-sm text-muted hover:text-text mb-6"
    >
      <ArrowLeft size={14} /> Retour aux articles
    </button>
  );
}

/**
 * Markdown-like section helpers for blog articles.
 */
export function Article({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <article className="max-w-3xl mx-auto">
      <BackToIndex />
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <div className="prose-dark space-y-5 text-sm leading-relaxed">
        {children}
      </div>
    </article>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold mt-8 mb-3 text-teal">{title}</h2>
      {children}
    </section>
  );
}

export function Formula({ children }: { children: string }) {
  return (
    <div className="bg-bg border border-border rounded-lg p-4 font-mono text-sm overflow-x-auto my-3">
      {children}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-xs">
      {children}
    </div>
  );
}

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="bg-coral/10 border border-coral/30 rounded-lg p-3 text-xs">
      {children}
    </div>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-text">{children}</p>;
}
