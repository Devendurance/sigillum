import { createElement } from "react";
import type { IconNode } from "lucide";

type LucideIconProps = {
  icon: IconNode;
  className?: string;
  label?: string;
  size?: number;
};

export function LucideIcon({ icon, className, label, size = 20 }: LucideIconProps) {
  return (
    <svg
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      className={className}
      fill="none"
      height={size}
      role={label ? "img" : undefined}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {icon.map(([tag, attrs], index) => {
        return createElement(tag, { key: `${tag}-${index}`, ...attrs });
      })}
    </svg>
  );
}
