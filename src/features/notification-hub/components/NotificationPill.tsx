// src/features/notification-hub/components/NotificationPill.tsx

import { forwardRef } from "react";
import { Terminal } from "lucide-react";

interface NotificationPillProps {
  count: number;
  urgentCount: number;
  onClick: () => void;
  isOpen?: boolean;
}

export const NotificationPill = forwardRef<HTMLButtonElement, NotificationPillProps>(
  ({ count, urgentCount, onClick, isOpen = false }, ref) => {
    return (
      <button
        ref={ref}
        data-pill-trigger
        onClick={onClick}
        aria-label={`Open notifications hub (${count} items)`}
        aria-expanded={isOpen}
        className="fixed bottom-10 right-10 z-[100] bg-surface-container-lowest border border-outline-variant rounded-full px-6 py-3 flex items-center gap-4 shadow-[0_32px_64px_-12px_rgba(95,94,97,0.08)] hover:shadow-[0_32px_64px_-12px_rgba(95,94,97,0.15)] transition-all duration-300 active:scale-95 group"
      >
        {/* Brand Mark */}
        <div className="flex items-center gap-2 border-r border-outline-variant pr-4">
          <span className="font-serif italic text-lg text-primary tracking-tighter">
            S
          </span>
          {urgentCount > 0 && (
            <div className="w-1 h-1 bg-tertiary rounded-full animate-pulse" />
          )}
        </div>

        {/* Status Text */}
        <div className="flex items-center gap-4">
          {urgentCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-sans text-[11px] font-bold text-tertiary">
                {urgentCount} Urgent
              </span>
              <div className="w-1.5 h-1.5 bg-tertiary rounded-full" />
            </div>
          )}

          <div className="h-3 w-[1px] bg-outline-variant" />

          <div className="flex items-center gap-1.5">
            <span className="font-sans text-[11px] font-medium text-outline">
              {count} Pending
            </span>
          </div>
        </div>

        {/* Trigger Icon */}
        <div className="ml-2 flex items-center justify-center bg-primary rounded-full p-1.5 group-hover:bg-primary-container transition-colors">
          <Terminal className="text-white !text-[14px]" />
        </div>
      </button>
    );
  }
);