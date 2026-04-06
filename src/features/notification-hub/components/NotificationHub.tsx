import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HubView, CategorySummaryItem, HubMetrics } from '../types';
import { HubHeader } from './HubHeader';
import { CategoryList } from './CategoryList';
import { CategoryListMVP } from './CategoryListMVP';
import { TicketQueue } from './TicketQueue';
import { ResolutionConsole } from './ResolutionConsole';
import { ResolutionConsoleMVP } from './ResolutionConsoleMVP';
import { LEVEL_1_HUB, LEVEL_2_QUEUE, LEVEL_3_CONSOLE } from '../types';
import { ConsoleSharedState } from './ResolutionConsole';

const UI_MODE = import.meta.env.VITE_UI_MODE || 'mvp';

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

  // Helper for badging
  const getRiskBadge = (risk: string) => {
    const badges = {
      high: { label: 'HIGH RISK', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      medium: { label: 'MED RISK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      low: { label: 'LOW RISK', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    };
    return badges[risk as keyof typeof badges] || badges.low;
  };

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
            {currentView === LEVEL_3_CONSOLE && activeConsoleData && UI_MODE === 'mvp' ? (
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
            ) : isExpanded && currentView === LEVEL_3_CONSOLE && activeConsoleData ? (
              // FUTURE-STATE: 3-Pane Split View (20/40/40) — non-mvp only
              <div className="h-full w-full grid grid-cols-[1fr_2fr_2fr] gap-0">
                {/* Pane 1 (Left - 20%): Customer Intelligence */}
                <div className="border-r border-outline-variant overflow-y-auto p-6 bg-surface-container-lowest">
                  {activeConsoleData.customerTier === 'VIP' && (
                    <div className="mb-2">
                      <span className="px-3 py-1 bg-tertiary/10 text-tertiary font-label text-[10px] font-bold rounded border border-tertiary/20">VIP</span>
                    </div>
                  )}
                  <h2 className="font-serif text-2xl tracking-tight text-primary pr-4 mb-3">{activeConsoleData.customerName}</h2>
                  <div className="flex items-center gap-2 text-on-surface-variant font-body text-sm mb-4">
                    <span className="material-symbols-outlined !text-[16px]">mail</span>
                    <span>{activeConsoleData.customerEmail.toLowerCase()}</span>
                  </div>
                  <div className="mb-8 space-y-3 border-t border-outline-variant pt-6">
                    <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500 mb-4">Account Stats</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="font-body text-sm text-on-surface-variant">Total Contacts</span>
                        <span className="font-label text-sm font-semibold text-primary tabular-nums">{activeConsoleData.totalContacts}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="font-body text-sm text-on-surface-variant">30-Day Volume</span>
                        <span className="font-label text-sm font-semibold text-primary tabular-nums">{activeConsoleData.thirtyDayVol}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Pane 2 (Center - 40%): AI Analysis & Original Message */}
                <div className="border-r border-outline-variant overflow-y-auto bg-white flex flex-col">
                  <div className="p-6 border-b border-outline-variant">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">AI Analysis</h3>
                      <span className={`font-label text-[9px] px-2 py-0.5 rounded border ${getRiskBadge(activeConsoleData.riskLevel).bg} ${getRiskBadge(activeConsoleData.riskLevel).text} ${getRiskBadge(activeConsoleData.riskLevel).border}`}>
                        {getRiskBadge(activeConsoleData.riskLevel).label}
                      </span>
                    </div>
                    <p className="font-body text-sm text-on-surface leading-relaxed mb-4">{activeConsoleData.aiSummary}</p>
                  </div>
                  <div className="p-6 flex-grow bg-surface-container-lowest">
                    <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500 mb-4">Original Message</h3>
                    <div className="bg-white p-5 rounded border border-outline-variant h-full max-h-[500px] overflow-y-auto">
                      <p className="font-body text-sm text-on-surface whitespace-pre-wrap leading-relaxed">{activeConsoleData.fullMessage}</p>
                    </div>
                  </div>
                </div>
                {/* Pane 3 (Right - 40%): Resolution Console */}
                <div className="overflow-y-auto bg-surface h-full">
                  <ResolutionConsole
                    ticket={activeConsoleData}
                    categoryName={activeCategory?.label ?? 'Unknown'}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setIsExpanded(!isExpanded)}
                    onBack={() => onNavigate(LEVEL_2_QUEUE, { categoryId: activeCategoryId ?? undefined })}
                    sharedState={consoleState}
                    onSharedStateChange={setConsoleState}
                  />
                </div>
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
                      {UI_MODE === 'mvp' ? (
                        <CategoryListMVP items={categories} onCategoryClick={(id) => onNavigate(LEVEL_2_QUEUE, { categoryId: id })} />
                      ) : (
                        <CategoryList items={categories} onCategoryClick={(id) => onNavigate(LEVEL_2_QUEUE, { categoryId: id })} />
                      )}
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
