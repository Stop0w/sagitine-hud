// src/features/notification-hub/components/CategoryItem.tsx

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
  const isHighUrgency = urgency === "high";

  const bgClass = isHighUrgency
    ? "bg-surface-container-low hover:bg-surface-container-high"
    : "bg-surface hover:bg-surface-container-low";

  const borderClass = isHighUrgency ? "border-l-4 border-tertiary" : "";

  const countColor = isHighUrgency ? "text-on-surface" : "text-zinc-400";

  const dotColor = isHighUrgency ? "bg-tertiary" : "bg-transparent";

  const getSubtitle = () => {
    if (isHighUrgency) {
      return `${count} Urgent Action${count > 1 ? 's' : ''}`;
    }
    if (urgency === "medium") {
      return "Awaiting Carrier Sync";
    }
    return "Standard Priority";
  };

  const subtitleColor = isHighUrgency ? "text-tertiary" : "text-zinc-400";

  return (
    <button
      onClick={() => onClick?.(id)}
      aria-label={`${label}: ${count} items`}
      className={`group flex items-center justify-between p-4 ${bgClass} transition-colors cursor-pointer ${borderClass} w-full text-left`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-body text-sm font-medium text-on-surface">
          {label}
        </span>
        <span className={`font-label text-[10px] tracking-wider ${subtitleColor} font-bold uppercase`}>
          {getSubtitle()}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className={`font-headline italic text-2xl ${countColor}`}>
          {count}
        </span>
        <div className={`w-2 h-2 ${dotColor}`}></div>
      </div>
    </button>
  );
}
