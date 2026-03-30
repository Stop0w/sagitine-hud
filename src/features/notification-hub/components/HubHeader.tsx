// src/features/notification-hub/components/HubHeader.tsx

import { X } from "lucide-react";
import type { HubView } from "../types";

interface HubHeaderProps {
  currentView: HubView;
  onClose: () => void;
}

export function HubHeader({ currentView, onClose }: HubHeaderProps) {
  return (
    <header className="flex justify-between items-center w-full px-4 h-14 bg-zinc-50 border-b border-outline-variant">
      <div className="flex flex-col justify-center">
        <span className="font-serif italic text-xl text-zinc-900">
          Sagitine CX
        </span>
        {currentView === "LEVEL_1_HUB" && (
          <span className="font-sans text-[11px] uppercase tracking-widest font-medium text-zinc-500">
            The Queue
          </span>
        )}
      </div>

      <button
        data-close-button
        onClick={onClose}
        className="text-zinc-500 hover:bg-zinc-200 p-1 transition-all active:opacity-80"
        aria-label="Close notifications hub"
      >
        <X style={{ fontSize: '1.125rem' }} />
      </button>
    </header>
  );
}