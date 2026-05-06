import type { ReactNode } from "react";

export interface ReportTableColumn<T> {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
}

interface ReportTableProps<T> {
  columns: Array<ReportTableColumn<T>>;
  rows: T[];
  emptyMessage?: string;
}

export function ReportTable<T>({
  columns,
  rows,
  emptyMessage = "No structured data available for this section.",
}: ReportTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[16px] border border-[var(--c-divider)] bg-[var(--c-surface)] px-4 py-6 text-sm text-[var(--c-text-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[16px] border border-[var(--c-divider)] bg-[var(--c-surface)]">
      <table className="rpt-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === "right" ? "num" : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === "right" ? "num" : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
