import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { HubView, CategorySummaryItem, HubMetrics } from '../types';
import { HubHeader } from './HubHeader';
import { CategoryList } from './CategoryList';
import { MetricsCard } from './MetricsCard';
import { TicketQueue } from './TicketQueue';
import { ResolutionConsole } from './ResolutionConsole';
import { LEVEL_1_HUB, LEVEL_2_QUEUE, LEVEL_3_CONSOLE } from '../types';

interface NotificationHubProps {
  isOpen: boolean;
  currentView: HubView;
  categories: CategorySummaryItem[];
  metrics: HubMetrics;
  onClose: () => void;
  onNavigate: (view: HubView, payload?: { categoryId?: string; ticketId?: string }) => void;
  pillRef?: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({
  isOpen,
  currentView,
  categories,
  metrics,
  onClose,
  onNavigate,
  pillRef,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        closeRef.current?.focus();
      }, 100);
    } else {
      setTimeout(() => {
        pillRef.current?.focus();
      }, 100);
    }
  }, [isOpen, pillRef]);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onNavigate(LEVEL_1_HUB);
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, onNavigate]);

  // Click outside handler
  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (isOpen && hubRef.current && !hubRef.current.contains(event.target as Node)) {
      if (currentView === LEVEL_1_HUB) {
        onClose();
      }
    }
  }, [isOpen, currentView, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isOpen, handleOutsideClick]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed bottom-6 right-6 z-[100] w-[400px] h-[600px] bg-surface flex flex-col clinical-shadow border border-outline-variant relative"
          ref={hubRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* STATUS RIBBON */}
          <div className="absolute left-0 top-14 bottom-0 w-1 bg-zinc-200" />

          {/* HEADER */}
          <HubHeader
            currentView={currentView}
            onClose={onClose}
          />

          {/* MAIN CONTENT AREA */}
          <main className="flex-grow overflow-y-auto p-6 space-y-8">
            {/* SYSTEM STATUS READOUT */}
            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">Live Queue Status</h2>
                <span className="font-label text-[10px] tracking-widest text-zinc-400">SYNC: ACTIVE</span>
              </div>
              <div className="h-[1px] w-full bg-outline-variant mb-6"></div>
            </section>

            {/* CATEGORY LIST (TRIAGED) */}
            <nav className="space-y-1">
              <CategoryList
                items={categories}
                onCategoryClick={(id) => onNavigate(LEVEL_2_QUEUE, { categoryId: id })}
              />
            </nav>

            {/* HUD ANALYTIC */}
            <div className="mt-12 p-4 border border-outline-variant bg-surface-container-lowest">
              <MetricsCard metrics={metrics} />
            </div>
          </main>

          {/* FOOTER */}
          <footer className="w-full flex flex-col gap-4 p-6 bg-zinc-50 border-t border-outline-variant">
            <div className="flex justify-between items-center">
              <a className="font-label text-[10px] tracking-[0.05em] uppercase font-bold text-zinc-900 flex items-center gap-2 hover:opacity-80 transition-all" href="#">
                ↗ Open Main Inbox in Outlook
              </a>
              <span className="font-label text-[10px] tracking-[0.05em] uppercase text-zinc-400">
                © SAGITINE HUD
              </span>
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
