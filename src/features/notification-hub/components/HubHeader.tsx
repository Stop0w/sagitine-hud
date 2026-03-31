// src/features/notification-hub/components/HubHeader.tsx

import type { HubView } from "../types";

interface HubHeaderProps {
  currentView: HubView;
  onClose: () => void;
}

export function HubHeader({ currentView, onClose }: HubHeaderProps) {
  return (
    <header className="flex justify-between items-center w-full px-4 h-14 bg-zinc-50 border-b border-outline-variant">
      <div className="flex items-center gap-2">
        <span className="font-serif italic text-xl text-zinc-900">Sagitine CX</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          className="text-zinc-500 hover:bg-zinc-200 p-1 transition-all active:opacity-80"
          aria-label="Minimize"
          onClick={(e) => {
            e.preventDefault();
            // Minimize functionality can be added later
          }}
        >
          <span className="material-symbols-outlined !text-[18px]" data-icon="minimize">
            minimize
          </span>
        </button>
        <button
          data-close-button
          onClick={onClose}
          className="text-zinc-500 hover:bg-zinc-200 p-1 transition-all active:opacity-80"
          aria-label="Close notifications hub"
        >
          <span className="material-symbols-outlined !text-[18px]" data-icon="close">
            close
          </span>
        </button>
      </div>
    </header>
  );
}
