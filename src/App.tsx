// src/App.tsx

import { useState, useRef } from "react";
import { NotificationPill } from "./features/notification-hub/components/NotificationPill";
import { NotificationHub } from "./features/notification-hub/components/NotificationHub";
import { useSagitineSync } from "./hooks/useSagitineSync";
import { transformApiToHubData } from "./lib/data-transformer";
import type { HubView } from "./features/notification-hub/types";

function App() {
  const pillRef = useRef<HTMLButtonElement>(null);
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [currentView, setCurrentView] = useState<HubView>("LEVEL_1_HUB");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch real data from WORKING API endpoint
  const { data: apiData, loading, error } = useSagitineSync('/api/hub/metrics', {
    pollingIntervalMs: 10000,
    enabled: true, // Re-enabled - using existing working endpoint
  });

  // Transform API response into UI format (use mock data as fallback)
  const activeHubData = apiData ? transformApiToHubData(apiData) : null;

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
        {/* Hero section with visual flair */}
        <div className="max-w-7xl mx-auto px-6 py-16">
          {/* Header with branding and visual element */}
          <div className="flex items-start justify-between mb-16">
            <div className="flex-1">
              <div className="flex flex-col gap-2 mb-6">
                <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-outline">Customer Service Command Center</span>
                <h1 className="font-serif text-7xl tracking-tighter text-primary leading-[0.95]">Sagitine Customer Service HUD</h1>
              </div>

              {/* One-line instruction */}
              <p className="font-sans text-lg text-on-surface-variant max-w-2xl leading-relaxed">
                Carefully review each enquiry, refine considered responses, and manage what needs attention — all in real time.
              </p>
            </div>

            {/* Treasure chest image as visual anchor */}
            <div className="hidden md:block ml-12 flex-shrink-0">
              <img
                src="/2303 Treasure Chest01102 square.JPG"
                alt="Sagitine Treasure Chest"
                className="w-48 h-48 object-cover rounded-[3rem] shadow-2xl"
              />
            </div>
          </div>

          {/* Status card with simplified messaging */}
          <div className="bg-surface-container-low p-10 border-l-4 border-primary rounded-[2rem] shadow-sm">
            {error ? (
              <div className="space-y-2">
                <p className="font-sans text-sm text-error font-medium">
                  ⚠️ Unable to connect to server
                </p>
                <p className="font-sans text-xs text-on-surface-variant">
                  Check your connection and try again
                </p>
              </div>
            ) : loading ? (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <p className="font-sans text-sm text-on-surface-variant">
                  Connecting to Sagitne servers...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Main status message */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-sans text-xl text-primary font-medium mb-1">
                      {activeHubData?.metrics.totalOpen || 0} enquires waiting
                    </p>
                    <p className="font-sans text-sm text-on-surface-variant">
                      {activeHubData?.metrics.urgentCount || 0} require urgent attention • Updated just now
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-4 py-2 bg-green-100 text-green-800 rounded-full font-sans text-xs font-bold tracking-wide">
                      ● LIVE
                    </span>
                  </div>
                </div>

                {/* Quick action guide */}
                <div className="pt-6 border-t border-surface-container-high">
                  <p className="font-sans text-xs text-on-surface-variant uppercase tracking-wider mb-3">
                    Getting started
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-xl">
                      <p className="font-sans text-xs text-primary font-medium mb-1">Step 1</p>
                      <p className="font-sans text-sm text-on-surface">Open your queue to view new enquiries</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl">
                      <p className="font-sans text-xs text-primary font-medium mb-1">Step 2</p>
                      <p className="font-sans text-sm text-on-surface">Review the email and prepared response</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl">
                      <p className="font-sans text-xs text-primary font-medium mb-1">Step 3</p>
                      <p className="font-sans text-sm text-on-surface">Approve or adjust before sending</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Additional info card */}
          <div className="mt-8 bg-white p-6 rounded-[2rem] border border-surface-container-high">
            <div className="flex items-start gap-4">
              <div className="text-3xl"><img
                src="/sagitine-logo.png"
                alt="Sagitine"
                width={50}
                height={50}
              /></div>
              <div>
                <p className="font-sans text-sm text-on-surface font-medium mb-2">
                  Sagitine Heads Up Display
                </p>
                <p className="font-sans text-xs text-on-surface-variant leading-relaxed">
                  Each message is thoughtfully reviewed and gently guided into the right place, with a considered draft prepared in our tone, ready for a final human touch.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* NotificationPill - embedded in page */}
        {activeHubData && (
          <NotificationPill
            ref={pillRef}
            count={activeHubData.metrics.totalOpen}
            urgentCount={activeHubData.metrics.urgentCount}
            onClick={() => setIsHubOpen(true)}
            isOpen={isHubOpen}
          />
        )}

        {/* NotificationHub - embedded in page layout (not a modal) */}
        {isHubOpen && activeHubData && (
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
