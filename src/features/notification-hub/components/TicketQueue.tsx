// src/features/notification-hub/components/TicketQueue.tsx

import type { QueueTicketItem, UrgencyLevel } from '../types';

interface TicketQueueProps {
  categoryId: string;
  tickets: QueueTicketItem[];
  onTicketClick: (ticketId: string) => void;
  onBack: () => void;
  sentTicketIds?: string[];
  onDismissTicket?: (id: string) => void;
}

export function TicketQueue({ categoryId, tickets, onTicketClick, onBack, sentTicketIds = [], onDismissTicket }: TicketQueueProps) {
  const getUrgencyColor = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'high':
        return 'text-tertiary';
      case 'medium':
        return 'text-amber-600';
      default:
        return 'text-zinc-500';
    }
  };

  const getUrgencyBorder = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'high':
        return 'border-l-4 border-tertiary';
      case 'medium':
        return 'border-l-4 border-amber-500';
      default:
        return '';
    }
  };

  const getStatusBadge = (status: QueueTicketItem['status'] | 'sent') => {
    const badges: Record<string, { label: string; bg: string; text: string }> = {
      new:              { label: 'NEW',    bg: 'bg-tertiary',    text: 'text-white' },
      drafted:          { label: 'REVIEW', bg: 'bg-zinc-900',    text: 'text-white' },
      review_required:  { label: 'REVIEW', bg: 'bg-amber-100',   text: 'text-amber-700' },
      triaged:          { label: 'READY',  bg: 'bg-orange-50',   text: 'text-orange-700' },
      sent:             { label: 'SENT',   bg: 'bg-green-100',   text: 'text-green-700' },
    };
    return badges[status] ?? badges.new;
  };

  const getRiskIndicator = (risk: QueueTicketItem['riskLevel']) => {
    const indicators = {
      high: { color: 'bg-tertiary', pulse: true },
      medium: { color: 'bg-amber-500', pulse: false },
      low: { color: 'bg-zinc-300', pulse: false },
    };
    return indicators[risk];
  };

  return (
    <div className="flex flex-col h-full">
      {/* BREADCRUMB HEADER */}
      <header className="flex items-center justify-between px-4 h-10 bg-zinc-50 border-b border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 px-2 py-1 rounded transition-colors group"
          >
            <span className="material-symbols-outlined !text-[20px] group-hover:scale-110 transition-transform" data-icon="arrow-back">
              arrow_back
            </span>
            <span className="font-label text-[10px] tracking-[0.2em] uppercase font-semibold">
              QUEUE <span className="text-zinc-400 mx-1">&gt;</span> {categoryId.replace(/_/g, ' ').toUpperCase()}
            </span>
          </button>
        </div>
        <span className="font-label text-[10px] tracking-widest text-zinc-400">
          {tickets.length} ITEMS
        </span>
      </header>

      {/* TICKET LIST */}
      <div className="flex-grow overflow-y-auto">
        {tickets.map((ticket) => {
          const isSent = sentTicketIds.includes(ticket.id);
          const displayStatus = isSent ? 'sent' : ticket.status;
          const badge = getStatusBadge(displayStatus);

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
            // NORMAL — clickable
            <button
              key={ticket.id}
              onClick={() => onTicketClick(ticket.id)}
              className={`w-full text-left p-4 border-b border-outline-variant hover:bg-surface-container-low transition-all ${getUrgencyBorder(ticket.urgency)} group`}
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
                  <span className={`font-label text-[9px] px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>

                  <div className="flex flex-col items-end gap-0.5">
                    <span className={`font-label text-[10px] font-bold ${getUrgencyColor(ticket.urgency)}`}>
                      {ticket.urgency.toUpperCase()}
                    </span>
                    <span className="font-label text-[9px] text-zinc-400">
                      {ticket.waitingMinutes}m
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined !text-[14px] text-zinc-400" data-icon="confidence">analytics</span>
                    <span className="font-label text-[10px] text-zinc-500">
                      {Math.round(ticket.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* FOOTER */}
      <footer className="px-4 py-3 bg-zinc-50 border-t border-outline-variant flex-shrink-0">
        <div className="flex justify-between items-center">
          <span className="font-label text-[10px] text-zinc-400">
            Sorted by: Urgency
          </span>
          <span className="font-label text-[10px] text-zinc-400">
            {tickets.filter(t => !sentTicketIds.includes(t.id) && t.status === 'new').length} New · {tickets.filter(t => !sentTicketIds.includes(t.id) && t.status === 'drafted').length} Review · {sentTicketIds.length} Sent
          </span>
        </div>
      </footer>
    </div>
  );
}