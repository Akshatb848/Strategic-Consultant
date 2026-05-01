import type { ReactNode } from "react";

import { SectionHeader } from "@/components/report/SectionHeader";
import { SoWhatCallout } from "@/components/report/SoWhatCallout";
import type { SoWhatCallout as SoWhatCalloutType } from "@/lib/api";

interface ReportSectionProps {
  id: string;
  number: string;
  title: string;
  narrative?: string;
  callout?: SoWhatCalloutType;
  children: ReactNode;
}

export function ReportSection({ id, number, title, narrative, callout, children }: ReportSectionProps) {
  return (
    <section id={id} className="report-section py-12">
      <SectionHeader number={number} title={title} />
      {narrative ? <p className="mb-6 text-[var(--c-text)]">{narrative}</p> : null}
      {children}
      {callout ? <SoWhatCallout callout={callout} /> : null}
    </section>
  );
}
