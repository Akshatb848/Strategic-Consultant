import type { ReactNode } from "react";

interface ExhibitContainerProps {
  exhibitNumber: number;
  title: string;
  source: string;
  footnote?: string;
  children: ReactNode;
  className?: string;
}

export function ExhibitContainer({
  exhibitNumber,
  title,
  source,
  footnote,
  children,
  className = "",
}: ExhibitContainerProps) {
  return (
    <figure className={`exhibit-wrap rounded-[18px] border border-[var(--c-divider)] bg-[var(--c-surface)] p-5 ${className}`}>
      <figcaption>
        <div className="exhibit-label">Exhibit {exhibitNumber}</div>
        <div className="exhibit-title">{title}</div>
      </figcaption>
      <div>{children}</div>
      <div className="exhibit-source">{source}</div>
      {footnote ? <div className="mt-2 text-[11px] text-[var(--c-text-faint)]">{footnote}</div> : null}
    </figure>
  );
}
