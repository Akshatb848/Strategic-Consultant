interface ReportCoverPageProps {
  title: string;
  subtitle: string;
  client: string;
  date: string;
  confidentiality?: string;
}

export function ReportCoverPage({
  title,
  subtitle,
  client,
  date,
  confidentiality = "Strictly confidential",
}: ReportCoverPageProps) {
  return (
    <section className="report-section report-section--cover flex min-h-[70vh] flex-col justify-between py-16">
      <div>
        <div className="cover-rule" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--c-brand)]">ASIS</div>
        <h1 className="mt-10 max-w-4xl font-[var(--font-display)] text-[var(--text-cover)] leading-tight text-[var(--c-brand)]">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg text-[var(--c-text-muted)]">{subtitle}</p>
      </div>

      <div className="grid gap-4 border-t border-[var(--c-divider)] pt-8 text-sm text-[var(--c-text-muted)] sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">Client</div>
          <div className="mt-2 text-base text-[var(--c-text)]">{client}</div>
        </div>
        <div className="sm:text-right">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-text-faint)]">
            Issued
          </div>
          <div className="mt-2 text-base text-[var(--c-text)]">{date}</div>
          <div className="mt-1">{confidentiality}</div>
        </div>
      </div>
    </section>
  );
}
