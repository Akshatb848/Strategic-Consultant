interface StatCalloutProps {
  label: string;
  value: string;
  detail?: string;
}

export function StatCallout({ label, value, detail }: StatCalloutProps) {
  return (
    <div className="stat-callout rounded-[16px] border border-[var(--c-divider)] bg-[var(--c-surface)] px-5 py-4">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {detail ? <div className="mt-2 text-xs text-[var(--c-text-muted)]">{detail}</div> : null}
    </div>
  );
}
