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
    <div className="min-h-screen bg-surface text-on-surface">
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