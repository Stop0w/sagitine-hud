// src/App.tsx

import { useState, useRef } from "react";
import { NotificationPill } from "./features/notification-hub/components/NotificationPill";
import { NotificationHub } from "./features/notification-hub/components/NotificationHub";
import { mockHubData } from "./features/notification-hub/data/mock-data";
import type { HubView } from "./features/notification-hub/types";

function App() {
  const pillRef = useRef<HTMLButtonElement>(null);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [currentView, setCurrentView] = useState<HubView>("LEVEL_1_HUB");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const handleNavigate = (
    view: HubView,
    payload?: { categoryId?: string; ticketId?: string }
  ) => {
    setCurrentView(view);
    if (payload?.categoryId !== undefined) {
      setActiveCategoryId(payload.categoryId);
    }
    if (payload?.ticketId !== undefined) {
      setActiveTicketId(payload.ticketId);
    }
  };

  const handleCloseHub = () => {
    setIsHubOpen(false);
    setCurrentView("LEVEL_1_HUB");
    setActiveCategoryId(null);
    setActiveTicketId(null);
  };

  return (
    <div className="min-h-screen bg-[#f3f3f3] text-on-surface">
      {/* Example page content to match reference design context */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col gap-1 mb-12">
          <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-outline">System Overview / Active Node</span>
          <h1 className="font-serif text-6xl tracking-tighter text-primary">Workspace Alpha</h1>
        </div>
        <div className="bg-surface-container-low p-8 border-l-4 border-primary">
          <p className="font-sans text-sm text-on-surface-variant">
            Sagitine AI CX Agent HUD System - Phase 1 Implementation<br/>
            Status: Active • Queue: {mockHubData.metrics.totalOpen} total • {mockHubData.metrics.urgentCount} urgent
          </p>
        </div>
      </div>

      <NotificationPill
        ref={pillRef}
        count={mockHubData.metrics.totalOpen}
        urgentCount={mockHubData.metrics.urgentCount}
        onClick={() => setIsHubOpen(true)}
        isOpen={isHubOpen}
      />

      <NotificationHub
        isOpen={isHubOpen}
        currentView={currentView}
        categories={mockHubData.categories}
        metrics={mockHubData.metrics}
        onClose={handleCloseHub}
        onNavigate={handleNavigate}
        pillRef={pillRef}
      />
    </div>
  );
}

export default App;