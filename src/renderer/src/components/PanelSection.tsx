import type { CSSProperties, ReactNode } from "react";

interface PanelSectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  action?: ReactNode;
  children: ReactNode;
  empty?: ReactNode;
  bodyStyle?: CSSProperties;
  style?: CSSProperties;
}

export function PanelSection({
  title,
  count,
  open,
  onToggle,
  action,
  children,
  empty,
  bodyStyle,
  style,
}: PanelSectionProps) {
  return (
    <div className={"subsection" + (open ? "" : " collapsed")} style={style}>
      <div className="head" onClick={onToggle}>
        <span className="chev">›</span>
        <span>{title}</span>
        <span className="count">({count})</span>
        {action}
      </div>
      {open && (
        <div className="subsection-body" style={bodyStyle}>
          {children}
          {count === 0 && empty}
        </div>
      )}
    </div>
  );
}
