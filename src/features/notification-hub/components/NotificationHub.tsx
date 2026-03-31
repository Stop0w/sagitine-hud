import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSagitineSync } from '@/hooks/useSagitineSync';
import { HubHeader } from './HubHeader';
import { CategoryList } from './CategoryList';
import { MetricsCard } from './MetricsCard';
import { TicketQueue } from './TicketQueue';
import { ResolutionConsole } from './ResolutionConsole';
import { NotificationHubView, LEVEL_1_HUB, LEVEL_2_QUEUE, LEVEL_3_CONSOLE } from '@/types/notification-hub';

interface NotificationHubProps {
  isOpen: boolean;
  onClose: () => void;
  pillRef: React.RefObject<HTMLButtonElement>;
}

export const NotificationHub: React.FC<NotificationHubProps> = ({
  isOpen,
  onClose,
  pillRef,
}) => {
  const [currentView, setCurrentView] = useState<NotificationHubView>(LEVEL_1_HUB);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const { data: hubData, updateLocalState } = useSagitineSync('/api/metrics', {
    pollingIntervalMs: 10000,
  });

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
        setCurrentView(LEVEL_1_HUB);
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Backdrop click handler
  const handleBackdropClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget && currentView === LEVEL_1_HUB) {
      onClose();
    }
  }, [currentView, onClose]);

  // Navigation handlers
  const handleNavigate = useCallback((view: NotificationHubView) => {
    setCurrentView(view);
  }, []);

  const handleBackToHub = useCallback(() => {
    setCurrentView(LEVEL_1_HUB);
  }, []);

  const handleTicketSelect = useCallback(() => {
    setCurrentView(LEVEL_3_CONSOLE);
  }, []);

  // Handle optimistic state updates
  const handleTicketAction = useCallback((ticketId: string, action: string) => {
    if (hubData) {
      const optimisticUpdate = {
        ...hubData,
        tickets: hubData.tickets.map(ticket =>
          ticket.id === ticketId
            ? { ...ticket, [action]: true }
            : ticket
        ),
      };
      updateLocalState(optimisticUpdate);
    }
  }, [hubData, updateLocalState]);

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
            onNavigate={handleNavigate}
            onBackToHub={handleBackToHub}
            ticketCount={hubData?.metrics?.total_tickets || 0}
            urgentCount={hubData?.metrics?.urgent_count || 0}
            sentToday={hubData?.metrics?.sent_today || 0}
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
                    <MetricsCard
                      title="Queue Overview"
                      value={hubData?.metrics?.total_tickets || 0}
                      change="+12"
                      changeType="positive"
                      icon="📊"
                    />
                    <CategoryList
                      categories={hubData?.categories || []}
                      selectedCategory={hubData?.selected_category}
                      onCategorySelect={updateLocalState}
                    />
                  </div>

                  {/* Right column */}
                  <div className="w-3/5 h-full overflow-hidden">
                    <TicketQueue
                      tickets={hubData?.tickets || []}
                      selectedTicket={hubData?.selected_ticket}
                      loading={false}
                      onTicketSelect={(ticket) => {
                        updateLocalState({ selected_ticket: ticket });
                        handleTicketSelect();
                      }}
                      onTicketAction={(ticketId, action) => handleTicketAction(ticketId, action)}
                    />
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
                  <TicketQueue
                    tickets={hubData?.tickets || []}
                    selectedTicket={hubData?.selected_ticket}
                    loading={false}
                    onTicketSelect={(ticket) => {
                      updateLocalState({ selected_ticket: ticket });
                      handleTicketSelect();
                    }}
                    onTicketAction={(ticketId, action) => handleTicketAction(ticketId, action)}
                  />
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
                  <ResolutionConsole
                    ticket={hubData?.selected_ticket}
                    onClose={handleBackToHub}
                    onSave={updateLocalState}
                  />
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