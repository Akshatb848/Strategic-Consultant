import type { RoadmapItem } from "@/lib/api";

interface GanttRoadmapProps {
  roadmap: RoadmapItem[];
}

export function GanttRoadmap({ roadmap }: GanttRoadmapProps) {
  if (roadmap.length === 0) {
    return (
      <div className="rounded-[16px] border border-[var(--c-divider)] bg-[var(--c-surface)] px-4 py-6 text-sm text-[var(--c-text-muted)]">
        No implementation roadmap is available for this analysis.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {roadmap.map((phase, index) => (
        <div key={phase.phase} className="rounded-[18px] border border-[var(--c-divider)] bg-[var(--c-surface)] p-5">
          <div className="grid gap-4 lg:grid-cols-[180px,1fr,180px]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                Phase {index + 1}
              </div>
              <div className="mt-2 text-lg font-semibold text-[var(--c-brand)]">{phase.phase}</div>
              <div className="mt-2 text-sm text-[var(--c-text-muted)]">{phase.owner_function}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                Actions
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[var(--c-text)]">
                {phase.actions.map((action) => (
                  <li key={action}>{action}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--c-text-faint)]">
                Success metrics
              </div>
              <ul className="mt-3 space-y-2 text-sm text-[var(--c-text)]">
                {phase.success_metrics.map((metric) => (
                  <li key={metric}>{metric}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
