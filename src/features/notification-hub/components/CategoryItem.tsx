// src/features/notification-hub/components/CategoryItem.tsx

import { ChevronRight } from "lucide-react";
import type { UrgencyLevel } from "../types";

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
  const urgencyColor = urgency === "high" ? "border-tertiary" :
                       urgency === "medium" ? "border-secondary" :
                       "border-transparent";

  return (
    <button
      onClick={() => onClick?.(id)}
      aria-label={`${label}: ${count} items`}
      className={`group flex items-center justify-between p-4 bg-surface-container-low hover:bg-surface-container-high transition-colors cursor-pointer border-l-4 w-full text-left ${urgencyColor}`}
    >
      <div className="flex flex-col gap-1 flex-1">
        <span className="font-sans text-sm font-medium text-on-surface">
          {label}
        </span>
        {hasNew && urgency === "high" && (
          <div className="flex items-center gap-2">
            <span className="font-sans text-[10px] tracking-wider text-tertiary font-bold uppercase">
              {count} Urgent Action{count > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="font-serif italic text-2xl text-on-surface">
          {count}
        </span>
        <ChevronRight className="text-outline group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
}