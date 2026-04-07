// src/features/notification-hub/components/TicketQueue.tsx

import { useState, useEffect } from 'react';
import type { QueueTicketItem, UrgencyLevel } from '../types';
import { formatWaitTime } from '../../../lib/data-transformer';

interface TicketQueueProps {
  categoryId: string;
  tickets: QueueTicketItem[];
  onTicketClick: (ticketId: string) => void;
  onBack: () => void;
  sentTicketIds?: string[];
  onDismissTicket?: (id: string) => void;
  onDeleteTicket?: (id: string) => Promise<void>;
}

export function TicketQueue({ categoryId, tickets, onTicketClick, onBack, sentTicketIds = [], onDismissTicket, onDeleteTicket }: TicketQueueProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Two-tap delete for single rows: first tap arms (red), second tap confirms.
  // Auto-disarms after 2.5s — prevents accidental archives.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!pendingDeleteId) return;
    const timer = setTimeout(() => setPendingDeleteId(null), 2500);
    return () => clearTimeout(timer);
  }, [pendingDeleteId]);

  // Clear selection when tickets list changes (e.g. after archive)
  useEffect(() => {
    setSelectedIds(prev => {
      const ticketIdSet = new Set(tickets.map(t => t.id));
      const next = new Set([...prev].filter(id => ticketIdSet.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tickets]);

  const activeTickets = tickets.filter(t => !sentTicketIds.includes(t.id));
  const allActiveSelected = activeTickets.length > 0 && activeTickets.every(t => selectedIds.has(t.id));

  const toggleSelect = (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(ticketId) ? next.delete(ticketId) : next.add(ticketId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allActiveSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeTickets.map(t => t.id)));
    }
  };

  const handleBulkArchive = async () => {
    if (!onDeleteTicket || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => onDeleteTicket(id)));
      setSelectedIds(new Set());
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSingleDeleteClick = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    if (!onDeleteTicket) return;

    if (pendingDeleteId !== ticketId) {
      setPendingDeleteId(ticketId);
      return;
    }

    setPendingDeleteId(null);
    setDeletingIds(prev => new Set(prev).add(ticketId));
    try {
      await onDeleteTicket(ticketId);
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(ticketId); return s; });
    }
  };

  const getUrgencyColor = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'high':   return 'text-tertiary';
      case 'medium': return 'text-amber-600';
      default:       return 'text-zinc-500';
    }
  };

  const getUrgencyBorder = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'high':   return 'border-l-4 border-tertiary';
      case 'medium': return 'border-l-4 border-amber-500';
      default:       return '';
    }
  };

  const getStatusBadge = (status: QueueTicketItem['status'] | 'sent') => {
    const badges: Record<string, { label: string; bg: string; text: string }> = {
      new:             { label: 'NEW',    bg: 'bg-tertiary',  text: 'text-white' },
      drafted:         { label: 'REVIEW', bg: 'bg-zinc-900',  text: 'text-white' },
      review_required: { label: 'REVIEW', bg: 'bg-amber-100', text: 'text-amber-700' },
      triaged:         { label: 'READY',  bg: 'bg-orange-50', text: 'text-orange-700' },
      sent:            { label: 'SENT',   bg: 'bg-green-100', text: 'text-green-700' },
    };
    return badges[status] ?? badges.new;
  };

  const getRiskIndicator = (risk: QueueTicketItem['riskLevel']) => {
    const indicators = {
      high:   { color: 'bg-tertiary',   pulse: true },
      medium: { color: 'bg-amber-500',  pulse: false },
      low:    { color: 'bg-zinc-300',   pulse: false },
    };
    return indicators[risk];
  };

  const isSelecting = selectedIds.size > 0;

  return (
    <div className="flex flex-col h-full">
      {/* BREADCRUMB HEADER */}
      <header className="flex items-center justify-between px-4 h-10 bg-zinc-50 border-b border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 px-2 py-1 rounded transition-colors group"
          >
            <span className="material-symbols-outlined !text-[20px] group-hover:scale-110 transition-transform">
              arrow_back
            </span>
            <span className="font-label text-[10px] tracking-[0.2em] uppercase font-semibold">
              QUEUE <span className="text-zinc-400 mx-1">&gt;</span> {categoryId.replace(/_/g, ' ').toUpperCase()}
            </span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          {isSelecting && onDeleteTicket && (
            <button
              onClick={toggleSelectAll}
              className="font-label text-[10px] text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              {allActiveSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
          <span className="font-label text-[10px] tracking-widest text-zinc-400">
            {tickets.filter(t => !sentTicketIds.includes(t.id)).length} ITEMS
          </span>
        </div>
      </header>

      {/* TICKET LIST */}
      <div className="flex-grow overflow-y-auto">
        {tickets.map((ticket) => {
          const isSent = sentTicketIds.includes(ticket.id);
          const displayStatus = isSent ? 'sent' : ticket.status;
          const badge = getStatusBadge(displayStatus);
          const isSelected = selectedIds.has(ticket.id);

          return isSent ? (
            // SENT — non-clickable row with dismiss X
            <div
              key={ticket.id}
              className="w-full text-left p-4 border-b border-outline-variant bg-green-50/40 opacity-70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-headline text-sm font-semibold text-zinc-400 truncate line-through">
                      {ticket.customerName}
                    </h3>
                  </div>
                  <p className="font-body text-xs font-medium text-zinc-400 mb-1 truncate">
                    {ticket.subject}
                  </p>
                  <p className="font-label text-[10px] text-green-600 font-medium">
                    Response sent via info@sagitine.com
                  </p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-label text-[9px] px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>
                    {onDismissTicket && (
                      <button
                        onClick={() => onDismissTicket(ticket.id)}
                        title="Dismiss"
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-500 hover:text-zinc-800 transition-colors"
                      >
                        <span className="material-symbols-outlined !text-[12px]">close</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // NORMAL — clickable, selectable
            <div
              key={ticket.id}
              className={`relative flex items-stretch border-b border-outline-variant transition-all group ${
                isSelected ? 'bg-zinc-50' : ''
              } ${getUrgencyBorder(ticket.urgency)}`}
            >
              {/* Checkbox — visible on hover or when any selection is active */}
              {onDeleteTicket && (
                <button
                  onClick={(e) => toggleSelect(e, ticket.id)}
                  title={isSelected ? 'Deselect' : 'Select'}
                  className={`flex-shrink-0 flex items-center justify-center w-10 transition-all ${
                    isSelecting
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-zinc-800 border-zinc-800'
                      : 'border-zinc-300 group-hover:border-zinc-500'
                  }`}>
                    {isSelected && (
                      <span className="material-symbols-outlined !text-[11px] text-white">check</span>
                    )}
                  </span>
                </button>
              )}

              {/* Row content — clickable to open ticket */}
              <button
                onClick={() => !isSelecting ? onTicketClick(ticket.id) : toggleSelect({ stopPropagation: () => {} } as React.MouseEvent, ticket.id)}
                className={`flex-grow text-left p-4 hover:bg-surface-container-low transition-all ${onDeleteTicket ? 'pl-0' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left side - Customer info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-headline text-sm font-semibold text-primary truncate">
                        {ticket.customerName}
                      </h3>
                      {getRiskIndicator(ticket.riskLevel).pulse && (
                        <div className={`w-1.5 h-1.5 ${getRiskIndicator(ticket.riskLevel).color} rounded-full animate-pulse`} />
                      )}
                    </div>
                    <p className="font-body text-xs font-medium text-on-surface mb-1 truncate">
                      {ticket.subject}
                    </p>
                    <p className="font-body text-[11px] text-on-surface-variant line-clamp-2">
                      {ticket.preview}
                    </p>
                  </div>

                  {/* Right side - Status & metrics */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-label text-[9px] px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      {/* Single-delete X — hidden when multi-select is active */}
                      {onDeleteTicket && !isSelecting && (
                        <button
                          onClick={(e) => handleSingleDeleteClick(e, ticket.id)}
                          title={pendingDeleteId === ticket.id ? 'Tap again to archive' : 'Archive ticket'}
                          disabled={deletingIds.has(ticket.id)}
                          className={`w-5 h-5 flex items-center justify-center rounded-full transition-all opacity-0 group-hover:opacity-100 ${
                            deletingIds.has(ticket.id)
                              ? 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                              : pendingDeleteId === ticket.id
                              ? 'bg-red-500 text-white opacity-100'
                              : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-500 hover:text-zinc-800'
                          }`}
                        >
                          {deletingIds.has(ticket.id) ? (
                            <span className="material-symbols-outlined !text-[10px] animate-spin">refresh</span>
                          ) : (
                            <span className="material-symbols-outlined !text-[12px]">close</span>
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-0.5">
                      <span className={`font-label text-[10px] font-bold ${getUrgencyColor(ticket.urgency)}`}>
                        {ticket.urgency.toUpperCase()}
                      </span>
                      <span className="font-label text-[9px] text-zinc-400">
                        {formatWaitTime(ticket.waitingMinutes)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined !text-[14px] text-zinc-400">analytics</span>
                      <span className="font-label text-[10px] text-zinc-500">
                        {Math.round(ticket.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* FOOTER — bulk action bar when selecting, otherwise standard stats */}
      <footer className="px-4 py-3 bg-zinc-50 border-t border-outline-variant flex-shrink-0">
        {isSelecting && onDeleteTicket ? (
          <div className="flex items-center justify-between gap-3">
            <span className="font-label text-[11px] text-zinc-600 font-medium">
              {selectedIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="font-label text-[10px] text-zinc-500 hover:text-zinc-800 px-3 py-1.5 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkArchive}
                disabled={isBulkDeleting}
                className="flex items-center gap-1.5 font-label text-[10px] font-semibold px-3 py-1.5 rounded bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isBulkDeleting ? (
                  <>
                    <span className="material-symbols-outlined !text-[12px] animate-spin">refresh</span>
                    Archiving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined !text-[12px]">archive</span>
                    Archive {selectedIds.size}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center">
            <span className="font-label text-[10px] text-zinc-400">
              Sorted by: Urgency
            </span>
            <span className="font-label text-[10px] text-zinc-400">
              {tickets.filter(t => !sentTicketIds.includes(t.id) && t.status === 'new').length} New · {tickets.filter(t => !sentTicketIds.includes(t.id) && t.status === 'drafted').length} Review · {sentTicketIds.length} Sent
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}
