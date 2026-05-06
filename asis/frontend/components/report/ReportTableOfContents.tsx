import type { ReportTocItem } from "@/lib/reporting";

interface ReportTableOfContentsProps {
  items: ReportTocItem[];
}

export function ReportTableOfContents({ items }: ReportTableOfContentsProps) {
  return (
    <section className="report-section report-section--toc py-12">
      <div className="rpt-section-header">Table of contents</div>
      <ol className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 border-b border-[var(--c-divider)] pb-3">
            <a href={`#${item.id}`} className="text-sm text-[var(--c-text)] hover:text-[var(--c-brand)]">
              <span className="mr-2 text-[var(--c-text-muted)]">{item.number}.</span>
              {item.title}
            </a>
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--c-text-faint)]">
              Section
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
