// src/features/notification-hub/components/HubHeader.tsx

import type { HubView } from "../types";

interface HubHeaderProps {
  currentView: HubView;
  onClose: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function HubHeader({ currentView, onClose, isExpanded, onToggleExpand }: HubHeaderProps) {
  return (
    <header className="flex justify-between items-center w-full px-4 h-14 bg-zinc-50 border-b border-outline-variant flex-shrink-0">
      <div className="flex items-center gap-2">
        <span className="font-serif italic text-xl text-zinc-900">Sagitine CX</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleExpand}
          className="text-zinc-500 hover:bg-zinc-200 p-1.5 rounded transition-all active:opacity-80"
          aria-label={isExpanded ? 'Collapse to panel' : 'Expand to full screen'}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          <span className="material-symbols-outlined !text-[18px]">
            {isExpanded ? 'close_fullscreen' : 'open_in_full'}
          </span>
        </button>
        <button
          data-close-button
          onClick={onClose}
          className="text-zinc-500 hover:bg-zinc-200 p-1.5 rounded transition-all active:opacity-80"
          aria-label="Close notifications hub"
        >
          <span className="material-symbols-outlined !text-[18px]">close</span>
        </button>
      </div>
    </header>
  );
}
