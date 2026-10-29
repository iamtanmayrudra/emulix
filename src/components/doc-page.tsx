import type { ReactNode } from "react";

type Section = { title: string; body: ReactNode };

/** A readable text page: a title, an optional notice, and numbered sections. Used for terms, privacy and how it works. */
export function DocPage({ title, intro, notice, sections }: { title: string; intro: string; notice?: string; sections: Section[] }) {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted">{intro}</p>
        {notice && (
          <p role="note" className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            {notice}
          </p>
        )}
      </header>
      <div className="space-y-6">
        {sections.map((section, index) => (
          <section key={section.title} aria-labelledby={`doc-${index}`} className="rounded-2xl border border-border/70 bg-surface p-5 shadow-sm">
            <h2 id={`doc-${index}`} className="flex items-center gap-3 text-lg font-semibold tracking-tight">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-bold text-accent">
                {index + 1}
              </span>
              {section.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
