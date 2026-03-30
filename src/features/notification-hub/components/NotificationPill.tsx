// src/features/notification-hub/components/NotificationPill.tsx

import { forwardRef } from "react";
import { Terminal } from "lucide-react";

interface NotificationPillProps {
  count: number;
  hasUrgent: boolean;
  onClick: () => void;
  isOpen?: boolean;
}

export const NotificationPill = forwardRef<HTMLButtonElement, NotificationPillProps>(
  ({ count, hasUrgent, onClick, isOpen = false }, ref) => {
    return (
      <button
        ref={ref}
        data-pill-trigger
        onClick={onClick}
        aria-label={`Open notifications hub (${count} items)`}
        aria-expanded={isOpen}
        className="fixed bottom-10 right-10 z-40 bg-surface-container-lowest border border-outline-variant rounded-none px-6 py-3 flex items-center gap-4 shadow-[0_32px_64px_-12px_rgba(95,94,97,0.08)] hover:shadow-[0_32px_64px_-12px_rgba(95,94,97,0.15)] transition-all duration-300 active:scale-[0.98] group"
        style={{
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.05em',
        }}
      >
        {/* Brand Mark */}
        <div className="flex items-center gap-2 border-r border-outline-variant pr-4">
          <span
            className="font-serif italic text-lg text-primary tracking-tighter"
            style={{ fontSize: '1.125rem', lineHeight: 1 }}
          >
            S
          </span>
          {hasUrgent && (
            <div className="w-1 h-1 bg-tertiary rounded-full animate-pulse" />
          )}
        </div>

        {/* Status Text */}
        <div className="flex items-center gap-4">
          {hasUrgent && (
            <div className="flex items-center gap-1.5">
              <span
                className="font-sans text-[11px] font-bold text-tertiary uppercase"
                style={{ fontSize: '0.6875rem' }}
              >
                {count}
              </span>
              <span>Urgent</span>
              <div className="w-1.5 h-1.5 bg-tertiary rounded-full" />
            </div>
          )}

          <div className="h-3 w-[1px] bg-outline-variant" />

          <div className="flex items-center gap-1.5">
            <span
              className="font-sans text-[11px] font-medium text-outline uppercase"
              style={{ fontSize: '0.6875rem' }}
            >
              {count}
            </span>
            <span>Pending</span>
          </div>
        </div>

        {/* Trigger Icon */}
        <div className="ml-2 flex items-center justify-center bg-primary rounded-full p-1.5 group-hover:bg-primary-container transition-colors">
          <Terminal className="text-white" style={{ fontSize: '0.875rem' }} />
        </div>
      </button>
    );
  }
);