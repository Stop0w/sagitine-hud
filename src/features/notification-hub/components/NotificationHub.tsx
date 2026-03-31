import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
      // Move focus to close button when opened
      setTimeout(() => {
        closeRef.current?.focus();
      }, 100);
    } else {
      // Return focus to pill when closed
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

  // Backdrop click handler
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && currentView === LEVEL_1_HUB) {
      onClose();
    }
  }, [currentView, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-end p-6 bg-black/20 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
          ref={hubRef}
        >
          {/* THE HUB: SLIDE-UP WINDOW */}
          <motion.div
            className="w-[400px] h-[600px] bg-surface flex flex-col shadow-[0_32px_64px_rgba(0,0,0,0.1)] border border-outline-variant relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* STATUS RIBBON */}
            <div className="absolute left-0 top-14 bottom-0 w-1 bg-zinc-200" />

            {/* HEADER */}
            <header className="flex justify-between items-center w-full px-4 h-14 bg-zinc-50 border-b border-outline-variant">
              <div className="flex items-center gap-2">
                <span className="font-serif italic text-xl text-zinc-900">Sagitine CX</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  ref={closeRef}
                  onClick={onClose}
                  className="text-zinc-500 hover:bg-zinc-200 p-1 transition-all active:opacity-80"
                  aria-label="Minimize"
                >
                  <span className="material-symbols-outlined !text-[18px]" data-icon="minimize">minimize</span>
                </button>
                <button
                  onClick={onClose}
                  className="text-zinc-500 hover:bg-zinc-200 p-1 transition-all active:opacity-80"
                  aria-label="Close"
                >
                  <span className="material-symbols-outlined !text-[18px]" data-icon="close">close</span>
                </button>
              </div>
            </header>

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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};