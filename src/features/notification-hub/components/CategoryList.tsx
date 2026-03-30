// src/features/notification-hub/components/CategoryList.tsx

import type { CategorySummaryItem } from "../types";
import { CategoryItem } from "./CategoryItem";

interface CategoryListProps {
  items: CategorySummaryItem[];
  onCategoryClick?: (id: string) => void;
}

export function CategoryList({ items, onCategoryClick }: CategoryListProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-outline text-sm">
        Queue is clear
      </div>
    );
  }

  return (
    <nav className="space-y-1">
      <div className="flex items-baseline justify-between mb-2 mt-6">
        <h2 className="font-sans text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
          Live Queue Status
        </h2>
        <span className="font-sans text-[10px] tracking-widest text-zinc-400">
          SYNC: ACTIVE
        </span>
      </div>

      <div className="h-[1px] w-full bg-outline-variant mb-4" />

      {items.map((item) => (
        <CategoryItem
          key={item.id}
          id={item.id}
          label={item.label}
          count={item.count}
          urgency={item.urgency}
          hasNew={item.hasNew}
          onClick={onCategoryClick}
        />
      ))}
    </nav>
  );
}