interface SectionHeaderProps {
  number: string;
  title: string;
  className?: string;
}

export function SectionHeader({ number, title, className = "" }: SectionHeaderProps) {
  return (
    <div className={className}>
      <div className="rpt-section-header">
        {number}. {title}
      </div>
    </div>
  );
}
