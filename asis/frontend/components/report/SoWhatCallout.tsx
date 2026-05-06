import type { SoWhatCallout as SoWhatCalloutType } from "@/lib/api";

interface SoWhatCalloutProps {
  callout: SoWhatCalloutType;
}

export function SoWhatCallout({ callout }: SoWhatCalloutProps) {
  const rows = [
    ["Implication", callout.implication],
    ["Recommended action", callout.recommended_action],
    ["Risk of inaction", callout.risk_of_inaction],
  ].filter(([, value]) => Boolean(value));

  if (rows.length === 0) return null;

  return (
    <aside className="so-what-callout">
      <div className="so-what-label">So What</div>
      <div className="so-what-body space-y-2">
        {rows.map(([label, value]) => (
          <p key={label}>
            <strong>{label}:</strong> {value}
          </p>
        ))}
      </div>
    </aside>
  );
}
