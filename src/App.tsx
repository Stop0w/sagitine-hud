// src/App.tsx

import { useState, useRef } from "react";
import { NotificationPill } from "./features/notification-hub/components/NotificationPill";
import { NotificationHub } from "./features/notification-hub/components/NotificationHub";
import { mockHubData } from "./features/notification-hub/data/mock-data";
import { mockHubMvpData } from "./features/notification-hub/data/mvp-mock-data";
import type { HubView } from "./features/notification-hub/types";

const UI_MODE = import.meta.env.VITE_UI_MODE || 'mvp'; // Defaulting to MVP locally
const activeHubData = UI_MODE === 'mvp' ? mockHubMvpData : mockHubData;

function App() {
  const pillRef = useRef<HTMLButtonElement>(null);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [currentView, setCurrentView] = useState<HubView>("LEVEL_1_HUB");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

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
    setIsExpanded(false); // Reset expansion on close
  };

  return (
    <>
      {/* Main page content */}
      <div className="min-h-screen bg-[#f3f3f3] text-on-surface">
        {/* Example page content matching reference design */}
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col gap-1 mb-12">
            <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-outline">System Overview / Active Node</span>
            <h1 className="font-serif text-6xl tracking-tighter text-primary">Workspace Alpha</h1>
          </div>
          <div className="bg-surface-container-low p-8 border-l-4 border-primary">
            <p className="font-sans text-sm text-on-surface-variant">
              Sagitine AI CX Agent HUD System - Phase 1 Implementation<br/>
              Status: Active • Queue: {activeHubData.metrics.totalOpen} total • {activeHubData.metrics.urgentCount} urgent
               <span className="ml-4 font-bold text-[10px] tracking-widest text-[#0078D4]">[{UI_MODE.toUpperCase()} MODE]</span>
            </p>
          </div>
        </div>

        {/* NotificationPill - embedded in page */}
        <NotificationPill
          ref={pillRef}
          count={activeHubData.metrics.totalOpen}
          urgentCount={activeHubData.metrics.urgentCount}
          onClick={() => setIsHubOpen(true)}
          isOpen={isHubOpen}
        />

        {/* NotificationHub - embedded in page layout (not a modal) */}
        {isHubOpen && (
          <NotificationHub
            isOpen={isHubOpen}
            currentView={currentView}
            categories={activeHubData.categories}
            metrics={activeHubData.metrics}
            queueByCategory={activeHubData.queueByCategory}
            consoleByTicketId={activeHubData.consoleByTicketId}
            activeCategoryId={activeCategoryId}
            activeTicketId={activeTicketId}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            onClose={handleCloseHub}
            onNavigate={handleNavigate}
            pillRef={pillRef}
          />
        )}
      </div>
    </>
  );
}

export default App;
