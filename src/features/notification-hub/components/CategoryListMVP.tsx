import React from 'react';
import type { CategorySummaryItem } from '../types/mvp';
import { CategoryItem } from './CategoryItem';

interface CategoryListMVPProps {
  items: CategorySummaryItem[];
  onCategoryClick?: (id: string) => void;
}

// Group definitions — keys must match DB enum values written by classify.ts
const GROUPS = [
  {
    title: 'Orders & Delivery',
    keys: ['shipping_delivery', 'returns'],
  },
  {
    title: 'Product & Usage',
    keys: ['damaged_missing_faulty', 'product_usage', 'stock'],
  },
  {
    title: 'Sales & General Enquiries',
    keys: ['pre_purchase', 'brand_feedback', 'partnerships'],
  },
  {
    title: 'Exceptions & Control',
    keys: ['spam'],
  },
];

export function CategoryListMVP({ items, onCategoryClick }: CategoryListMVPProps) {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-outline text-sm">
        Queue is clear
      </div>
    );
  }

  // Map items by key for quick access
  const itemsByKey = items.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<string, CategorySummaryItem>);

  return (
    <div className="space-y-6">
      {GROUPS.map((group) => {
        // Find items that belong in this group AND have count > 0 (optional: show empty rows? The prompt says "visually group them rather than rendering 13 raw rows by default". We will only render groups/rows if they have items or just render all?).
        // Actually, rendering 13 empty rows is bad UI. We should filter items with count > 0, or just render exactly what the mock array dictates.
        const groupItems = group.keys
          .map(k => itemsByKey[k])
          .filter(Boolean)
          .filter(item => item.count > 0); // Only show categories with items

        if (groupItems.length === 0) return null;

        return (
          <section key={group.title} className="space-y-1">
            <h3 className="px-1 py-2 font-label text-[9px] tracking-[0.2em] font-bold text-zinc-400 uppercase">
              {group.title}
            </h3>
            <nav className="space-y-1">
              {groupItems.map(item => (
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
          </section>
        );
      })}
    </div>
  );
}
