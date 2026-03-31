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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
      ref={hubRef}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Main hub container */}
      <motion.div
        className="relative w-full max-w-7xl h-[90vh] max-h-[900px] bg-white rounded-[3rem] shadow-2xl overflow-hidden"
        initial={{
          opacity: 0,
          scale: 0.8,
          y: 50,
          filter: 'blur(20px)',
          boxShadow: '0 0 0 rgba(0,0,0,0)'
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          filter: 'blur(0px)',
          boxShadow: '0 50px 100px -20px rgba(0,0,0,0.25), 0 30px 60px -30px rgba(0,0,0,0.1)'
        }}
        exit={{
          opacity: 0,
          scale: 0.8,
          y: 50,
          filter: 'blur(20px)',
          boxShadow: '0 0 0 rgba(0,0,0,0)'
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
          mass: 0.8,
          duration: 0.4
        }}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-3 rounded-full bg-white/80 backdrop-blur-sm border border-white/20 shadow-lg hover:bg-white transition-all duration-200 w-12 h-12 flex items-center justify-center"
          aria-label="Close notification hub"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Hub content */}
        <div className="h-full flex flex-col">
          {/* Hub Header */}
          <HubHeader
            currentView={currentView}
            onClose={onClose}
          />

          {/* Main content area */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              {currentView === LEVEL_1_HUB && (
                <motion.div
                  key="level1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="h-full flex"
                >
                  {/* Left column */}
                  <div className="w-2/5 h-full border-r border-gray-100 overflow-hidden">
                    <MetricsCard metrics={metrics} />
                    <CategoryList
                      items={categories}
                      onCategoryClick={(id) => onNavigate(LEVEL_2_QUEUE, { categoryId: id })}
                    />
                  </div>

                  {/* Right column */}
                  <div className="w-3/5 h-full overflow-hidden">
                    <TicketQueue />
                  </div>
                </motion.div>
              )}

              {currentView === LEVEL_2_QUEUE && (
                <motion.div
                  key="level2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="h-full"
                >
                  <TicketQueue />
                </motion.div>
              )}

              {currentView === LEVEL_3_CONSOLE && (
                <motion.div
                  key="level3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="h-full"
                >
                  <ResolutionConsole />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Scroll indicator */}
        {currentView === LEVEL_1_HUB && (
          <motion.div
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-white/20 shadow-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </motion.div>
        )}
      </motion.div>
    </div>,
    document.body
  );
};