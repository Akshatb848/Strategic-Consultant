import type { ReactNode } from "react";

interface SectionLayoutProps {
  narrative?: string;
  aside?: ReactNode;
  children: ReactNode;
}

export function SectionLayout({ narrative, aside, children }: SectionLayoutProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr),minmax(240px,0.65fr)]">
      <div className="space-y-5">
        {narrative ? <p className="text-[var(--c-text)]">{narrative}</p> : null}
        {children}
      </div>
      {aside ? <aside className="space-y-4">{aside}</aside> : null}
    </div>
  );
}
