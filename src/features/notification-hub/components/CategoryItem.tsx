// src/features/notification-hub/components/CategoryItem.tsx

import { ChevronRight } from "lucide-react";
import type { UrgencyLevel } from "../types";
import { getUrgencyColor } from "../utils/formatters";

interface CategoryItemProps {
  id: string;
  label: string;
  count: number;
  urgency: UrgencyLevel;
  hasNew?: boolean;
  onClick?: (id: string) => void;
}

export function CategoryItem({
  id,
  label,
  count,
  urgency,
  hasNew = false,
  onClick
}: CategoryItemProps) {
  return (
    <button
      onClick={() => onClick?.(id)}
      className="group flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border-l-4 w-full text-left"
      style={{
        borderColor: urgency === "high" ? "rgb(172, 52, 21)" :
                   urgency === "medium" ? "rgb(93, 94, 102)" :
                   "transparent"
      }}
    >
      <div className="flex flex-col gap-1 flex-1">
        <span
          className="font-sans text-sm font-medium text-on-surface"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          {label}
        </span>
        {hasNew && (
          <div className="flex items-center gap-2">
            <span
              className="font-sans text-[10px] tracking-wider text-tertiary font-bold uppercase"
              style={{ fontSize: '0.625rem' }}
            >
              {urgency === "high" && "1 Urgent Action"}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span
          className="font-serif italic text-2xl text-on-surface"
          style={{ fontFamily: 'Noto Serif, serif' }}
        >
          {count}
        </span>
        <ChevronRight className="text-outline group-hover:text-primary transition-colors" style={{ fontSize: '1rem' }} />
      </div>
    </button>
  );
}