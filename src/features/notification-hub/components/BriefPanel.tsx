import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BriefTicket {
  id: string;
  customerName: string;
  subject: string;
  urgency: string;
  category: string;
  waitingMinutes: number;
  sentAt?: string;
}

interface OldestUnanswered {
  customerName: string;
  waitingMinutes: number;
}

interface MorningBriefData {
  needsResponse: BriefTicket[];
  totalOpen: number;
  urgentCount: number;
  newSinceYesterday: number;
  oldestUnanswered: OldestUnanswered | null;
  aiSummary: string;
}

interface EveningBriefData {
  actionedToday: BriefTicket[];
  actionedCount: number;
  stillOpen: BriefTicket[];
  stillOpenCount: number;
  newArrivedToday: number;
  aiSummary: string;
}

interface BriefPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function urgencyBadgeClasses(urgency: string): string {
  switch (urgency) {
    case 'high':
      return 'bg-tertiary text-white';
    case 'medium':
      return 'bg-zinc-700 text-white';
    case 'low':
    default:
      return 'bg-zinc-200 text-zinc-600';
  }
}

function getDefaultTab(): BriefTab {
  const now = new Date();
  // Convert to AEST (UTC+10) — rough check: if UTC hour + 10 >= 14, it's afternoon in Sydney
  const aestHour = (now.getUTCHours() + 10) % 24;
  return aestHour >= 14 ? 'evening' : 'morning';
}

function formatBriefDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney',
  });
  return formatter.format(now) + ' AEST';
}

type BriefTab = 'morning' | 'evening';

export const BriefPanel: React.FC<BriefPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<BriefTab>(getDefaultTab());
  const [morningData, setMorningData] = useState<MorningBriefData | null>(null);
  const [eveningData, setEveningData] = useState<EveningBriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setExpanded(false);
      return;
    }

    // Reset to time-appropriate tab each time panel opens
    setActiveTab(getDefaultTab());

    const controller = new AbortController();

    async function fetchBriefs() {
      setLoading(true);
      setError(null);
      try {
        const [morningRes, eveningRes] = await Promise.all([
          fetch('/api/hub-brief/morning', { signal: controller.signal }),
          fetch('/api/hub-brief/evening', { signal: controller.signal }),
        ]);

        if (!morningRes.ok || !eveningRes.ok) {
          throw new Error('Failed to fetch brief data');
        }

        const morningJson = await morningRes.json();
        const eveningJson = await eveningRes.json();

        setMorningData(morningJson.data ?? morningJson);
        setEveningData(eveningJson.data ?? eveningJson);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Something went wrong');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBriefs();

    return () => controller.abort();
  }, [isOpen]);

  const renderAiSummary = (summary: string) => {
    if (!summary) return null;
    // Strip any markdown bold/italic syntax that Haiku may return
    const cleaned = summary.replace(/\*{1,3}/g, '').replace(/_{1,3}/g, '');
    return (
      <div className="mx-4 my-3 px-3 py-2.5 bg-zinc-50 border border-zinc-200">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined !text-[14px] text-zinc-400 mt-0.5 shrink-0">
            auto_awesome
          </span>
          <p className="font-body text-[12px] leading-relaxed text-zinc-600">
            {cleaned}
          </p>
        </div>
      </div>
    );
  };

  const renderTicketRow = (ticket: BriefTicket, icon?: string) => (
    <div
      key={ticket.id}
      className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 transition-colors"
    >
      {icon && (
        <span className="material-symbols-outlined text-[18px] text-zinc-400 shrink-0">
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-body text-[13px] font-medium text-zinc-800 truncate">
          {ticket.customerName}
        </p>
        <p className="font-body text-[11px] text-zinc-400 truncate">
          {ticket.subject}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`font-label text-[9px] tracking-[0.1em] uppercase font-semibold px-2 py-0.5 ${urgencyBadgeClasses(ticket.urgency)}`}
        >
          {ticket.urgency}
        </span>
        <span className="font-label text-[10px] tracking-wide text-zinc-400 whitespace-nowrap">
          {ticket.sentAt
            ? new Date(ticket.sentAt).toLocaleTimeString('en-AU', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Australia/Sydney',
              })
            : formatWaitTime(ticket.waitingMinutes)}
        </span>
      </div>
    </div>
  );

  const renderSentTicketRow = (ticket: BriefTicket) => (
    <div
      key={ticket.id}
      className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 transition-colors"
    >
      <span className="material-symbols-outlined text-[18px] text-green-600 shrink-0">
        check_circle
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-body text-[13px] font-medium text-zinc-800 truncate">
          {ticket.customerName}
        </p>
        <p className="font-body text-[11px] text-zinc-400 truncate">
          {ticket.subject}
        </p>
      </div>
      <div className="shrink-0">
        <span className="font-label text-[10px] tracking-wide text-zinc-400 whitespace-nowrap">
          {ticket.sentAt
            ? `Sent ${new Date(ticket.sentAt).toLocaleTimeString('en-AU', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Australia/Sydney',
              })}`
            : ''}
        </span>
      </div>
    </div>
  );

  const renderMorning = () => {
    if (!morningData) return null;

    return (
      <div className="flex flex-col">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4 border-b border-zinc-100">
          <div className="text-center">
            <p className="font-headline text-2xl font-semibold text-zinc-800">
              {morningData.totalOpen}
            </p>
            <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              Open
            </p>
          </div>
          <div className="text-center">
            <p className="font-headline text-2xl font-semibold text-tertiary">
              {morningData.urgentCount}
            </p>
            <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              Urgent
            </p>
          </div>
          <div className="text-center">
            <p className="font-headline text-2xl font-semibold text-zinc-800">
              {morningData.newSinceYesterday}
            </p>
            <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              New Overnight
            </p>
          </div>
        </div>

        {/* AI Summary */}
        {renderAiSummary(morningData.aiSummary)}

        {/* Oldest Unanswered Banner */}
        {morningData.oldestUnanswered && morningData.oldestUnanswered.waitingMinutes > 120 && (
          <div className="flex items-center gap-2 mx-4 mb-2 px-3 py-2 bg-orange-50 border border-orange-200">
            <span className="material-symbols-outlined !text-[16px] text-orange-500 shrink-0">
              warning
            </span>
            <p className="font-body text-[12px] text-zinc-700">
              <span className="font-semibold">Oldest unanswered:</span>{' '}
              {morningData.oldestUnanswered.customerName} —{' '}
              {formatWaitTime(morningData.oldestUnanswered.waitingMinutes)}
            </p>
          </div>
        )}

        {/* Section Label */}
        <div className="px-4 pt-3 pb-2">
          <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
            Needs Response
          </p>
        </div>

        {/* Ticket List */}
        <div className="overflow-y-auto flex-1">
          {morningData.needsResponse.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-[28px] text-zinc-300 mb-2 block">
                check_circle
              </span>
              <p className="font-body text-[13px] text-zinc-400">
                All clear — no tickets awaiting response.
              </p>
            </div>
          ) : (
            morningData.needsResponse.map((t) => renderTicketRow(t, 'mail'))
          )}
        </div>
      </div>
    );
  };

  const renderEvening = () => {
    if (!eveningData) return null;

    return (
      <div className="flex flex-col">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 px-4 py-4 border-b border-zinc-100">
          <div className="text-center">
            <p className="font-headline text-2xl font-semibold text-zinc-800">
              {eveningData.actionedCount}
            </p>
            <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              Actioned
            </p>
          </div>
          <div className="text-center">
            <p className="font-headline text-2xl font-semibold text-zinc-800">
              {eveningData.stillOpenCount}
            </p>
            <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              Still Open
            </p>
          </div>
          <div className="text-center">
            <p className="font-headline text-2xl font-semibold text-zinc-800">
              {eveningData.newArrivedToday}
            </p>
            <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              New Today
            </p>
          </div>
        </div>

        {/* AI Summary */}
        {renderAiSummary(eveningData.aiSummary)}

        {/* Actioned Today */}
        <div className="px-4 pt-3 pb-2">
          <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
            Actioned Today
          </p>
        </div>
        <div className="overflow-y-auto">
          {eveningData.actionedToday.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <p className="font-body text-[12px] text-zinc-400">
                No tickets actioned today.
              </p>
            </div>
          ) : (
            eveningData.actionedToday.map((t) => renderSentTicketRow(t))
          )}
        </div>

        {/* Still Open */}
        <div className="px-4 pt-4 pb-2 border-t border-zinc-100">
          <p className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
            Still Open
          </p>
        </div>
        <div className="overflow-y-auto flex-1">
          {eveningData.stillOpen.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <p className="font-body text-[12px] text-zinc-400">
                Nothing carrying over — inbox zero.
              </p>
            </div>
          ) : (
            eveningData.stillOpen.map((t) => renderTicketRow(t, 'schedule'))
          )}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={`fixed bottom-32 right-10 z-[100] bg-white border border-outline-variant shadow-[0_32px_64px_-12px_rgba(95,94,97,0.12)] flex flex-col transition-all duration-300 ${
            expanded ? 'w-[700px] max-h-[80vh]' : 'w-[400px] max-h-[600px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-zinc-600">
                summarize
              </span>
              <h2 className="font-headline text-[15px] font-semibold text-zinc-800">
                Daily Brief
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-7 h-7 flex items-center justify-center hover:bg-zinc-100 transition-colors"
                aria-label={expanded ? 'Collapse brief panel' : 'Expand brief panel'}
              >
                <span className="material-symbols-outlined text-[18px] text-zinc-500">
                  {expanded ? 'close_fullscreen' : 'open_in_full'}
                </span>
              </button>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center hover:bg-zinc-100 transition-colors"
                aria-label="Close brief panel"
              >
                <span className="material-symbols-outlined text-[18px] text-zinc-500">
                  close
                </span>
              </button>
            </div>
          </div>

          {/* Date Line */}
          <div className="px-4 pb-2">
            <p className="font-body text-[11px] text-zinc-400 tracking-wide">
              {formatBriefDate()}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex mx-4 mb-2 bg-zinc-100 p-0.5">
            {(['morning', 'evening'] as BriefTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 font-label text-[11px] tracking-[0.1em] uppercase font-semibold transition-all ${
                  activeTab === tab
                    ? 'bg-white text-zinc-800 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {tab === 'morning' ? 'Morning' : 'Evening'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <span className="material-symbols-outlined text-[24px] text-zinc-300 animate-spin">
                  progress_activity
                </span>
              </div>
            )}

            {error && (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-[28px] text-zinc-300 mb-2 block">
                  error_outline
                </span>
                <p className="font-body text-[13px] text-zinc-400">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <>
                {activeTab === 'morning' && renderMorning()}
                {activeTab === 'evening' && renderEvening()}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
