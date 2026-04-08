import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HubView, CategorySummaryItem, HubMetrics, ConsoleSharedState } from '../types';
import { HubHeader } from './HubHeader';
import { CategoryListMVP } from './CategoryListMVP';
import { TicketQueue } from './TicketQueue';
import { ResolutionConsoleMVP } from './ResolutionConsoleMVP';
import { LEVEL_1_HUB, LEVEL_2_QUEUE, LEVEL_3_CONSOLE } from '../types';

interface NotificationHubProps {
  isOpen: boolean;
  currentView: HubView;
  categories: CategorySummaryItem[];
  metrics: HubMetrics;
  queueByCategory: Record<string, any[]>;
  consoleByTicketId: Record<string, any>;
  activeCategoryId: string | null;
  activeTicketId: string | null;
  isExpanded: boolean;
  setIsExpanded: (val: boolean) => void;
  onClose: () => void;
  onNavigate: (view: HubView, payload?: { categoryId?: string; ticketId?: string }) => void;
  pillRef?: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({
  isOpen,
  currentView,
  categories,
  metrics,
  queueByCategory,
  consoleByTicketId,
  activeCategoryId,
  activeTicketId,
  isExpanded,
  setIsExpanded,
  onClose,
  onNavigate,
  pillRef,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const [consoleState, setConsoleState] = useState<ConsoleSharedState>({
    isEditing: false,
    editedResponse: '',
    isProofing: false,
    isProofed: false,
    isDismissed: false
  });
  const [localSentTicketIds, setLocalSentTicketIds] = useState<string[]>([]);
  const [localArchivedTicketIds, setLocalArchivedTicketIds] = useState<string[]>([]);

  const handleArchiveTicket = async (ticketId: string): Promise<void> => {
    const res = await fetch(`/api/hub/ticket/${ticketId}/resolve`, { method: 'POST' });
    if (!res.ok) throw new Error(`Archive failed: ${res.status}`);
    setLocalArchivedTicketIds(prev => [...prev, ticketId]);
  };

  // Focus management
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => closeRef.current?.focus(), 100);
    } else {
      setTimeout(() => pillRef?.current?.focus(), 100);
    }
  }, [isOpen, pillRef]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        if (isExpanded) {
           setIsExpanded(false);
        } else {
           onNavigate(LEVEL_1_HUB);
           onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, onNavigate, isExpanded, setIsExpanded]);

  // Click outside handler
  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (isOpen && hubRef.current && !hubRef.current.contains(event.target as Node)) {
      if (currentView === LEVEL_1_HUB && !isExpanded) {
        onClose();
      }
    }
  }, [isOpen, currentView, onClose, isExpanded]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen, handleOutsideClick]);

  if (!isOpen) return null;

  // Derive active items for rendering
  const activeCategory = activeCategoryId ? categories.find((c) => c.id === activeCategoryId) : null;
  const activeQueue = (activeCategory ? queueByCategory[activeCategory.id] || [] : [])
    .filter((t: any) => !localArchivedTicketIds.includes(t.id));
  const activeConsoleData = activeTicketId ? consoleByTicketId[activeTicketId] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
           className={`fixed z-[100] bg-surface flex flex-col clinical-shadow border border-outline-variant ${
            isExpanded
              ? 'inset-6 rounded-lg' // Takes full screen minus 24px margins
              : 'bottom-32 right-10 w-[400px] h-[600px] rounded-lg' // Default bottom right floating panel precisely spaced above the NotificationPill
          }`}
          ref={hubRef}
          initial={{ opacity: 0, y: isExpanded ? 0 : 20, scale: isExpanded ? 0.98 : 1 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isExpanded ? 0 : 20, scale: isExpanded ? 0.98 : 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* STATUS RIBBON - Only show in normal mode */}
          {!isExpanded && (
            <div className="absolute left-0 top-14 bottom-0 w-1 bg-zinc-200" />
          )}

          {/* HEADER */}
          <HubHeader
            currentView={currentView}
            onClose={onClose}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
          />

          {/* MAIN CONTENT AREA */}
          <main className="flex-grow overflow-hidden relative bg-white">
            {currentView === LEVEL_3_CONSOLE && activeConsoleData ? (
              // SINGLE ResolutionConsoleMVP instance — isExpanded prop controls layout internally.
              // Must never be split into two conditional instances or state resets on expand/collapse.
              <div className="h-full w-full">
                <ResolutionConsoleMVP
                  data={activeConsoleData}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setIsExpanded(!isExpanded)}
                  onBack={() => onNavigate(LEVEL_2_QUEUE, { categoryId: activeCategoryId ?? undefined })}
                  sharedState={consoleState}
                  onSharedStateChange={setConsoleState}
                  onApprove={(finalText) => {
                    if (activeTicketId) {
                      setLocalSentTicketIds(prev => [...prev, activeTicketId]);
                    }
                    onNavigate(LEVEL_2_QUEUE, { categoryId: activeCategoryId ?? undefined });
                  }}
                />
              </div>
            ) : (
              // NORMAL VIEW — Hub and Queue only (console is handled by the first branch above)
              <div className="h-full flex flex-col w-full">
                {currentView === LEVEL_1_HUB && (
                  <div className="flex flex-col h-full">
                    <div className="p-6 pb-2 border-b border-outline-variant bg-zinc-50">
                      <div className="flex items-baseline justify-between mb-2">
                        <h2 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">Live Queue Status</h2>
                        <span className="font-label text-[10px] tracking-widest text-zinc-400">SYNC: ACTIVE</span>
                      </div>
                    </div>
                    <div className="flex-grow overflow-y-auto bg-white">
                      <CategoryListMVP items={categories} onCategoryClick={(id) => onNavigate(LEVEL_2_QUEUE, { categoryId: id })} />
                    </div>
                  </div>
                )}

                {currentView === LEVEL_2_QUEUE && activeCategoryId && (
                  <TicketQueue
                    categoryId={activeCategoryId}
                    tickets={activeQueue}
                    onBack={() => onNavigate(LEVEL_1_HUB)}
                    onTicketClick={(ticketId: string) => onNavigate(LEVEL_3_CONSOLE, { categoryId: activeCategoryId, ticketId })}
                    sentTicketIds={localSentTicketIds}
                    onDismissTicket={(id) => setLocalSentTicketIds(prev => prev.filter(t => t !== id))}
                    onDeleteTicket={handleArchiveTicket}
                  />
                )}
              </div>
            )}
          </main>
          
          {/* FOOTER - Collapsed mode only */}
          {!isExpanded && currentView === LEVEL_1_HUB && (
            <footer className="w-full flex-shrink-0 flex flex-col gap-4 p-4 border-t border-outline-variant bg-zinc-50">
              <div className="flex justify-between items-center px-2">
                <button className="font-label text-[9px] tracking-[0.05em] uppercase font-bold text-zinc-600 flex items-center gap-1 hover:text-[#0078D4] transition-colors">
                  <span className="material-symbols-outlined !text-[14px]">open_in_new</span>
                  Open Default View
                </button>
                <span className="font-label text-[9px] tracking-[0.05em] uppercase text-zinc-400">
                  Sagitine CX
                </span>
              </div>
            </footer>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
