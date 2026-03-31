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
