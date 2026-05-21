import type { ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ value, options, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div className={className ?? "seg"}>
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
