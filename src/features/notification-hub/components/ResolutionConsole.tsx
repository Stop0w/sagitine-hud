// src/features/notification-hub/components/ResolutionConsole.tsx

import type { ResolutionConsoleData } from '../types';

export interface ConsoleSharedState {
  isEditing: boolean;
  editedResponse: string;
  isProofing: boolean;
  isProofed: boolean;
  isDismissed: boolean;
  proofResult?: any;
  hasEditedAfterProof?: boolean;
}

interface ResolutionConsoleProps {
  ticket: ResolutionConsoleData;
  categoryName: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onBack: () => void;
  onApprove?: (finalText: string) => void;
  sharedState: ConsoleSharedState;
  onSharedStateChange: (state: ConsoleSharedState) => void;
}

export function ResolutionConsole({
  ticket,
  categoryName,
  isExpanded = false,
  onToggleExpand,
  onBack,
  onApprove,
  sharedState,
  onSharedStateChange,
}: ResolutionConsoleProps) {
  const { isEditing, editedResponse, isProofing, isProofed, isDismissed } = sharedState;

  const updateState = (updates: Partial<ConsoleSharedState>) => {
    onSharedStateChange({ ...sharedState, ...updates });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateState({ editedResponse: e.target.value, isProofed: false, isDismissed: false });
  };

  const handleProofClick = () => {
    if (isProofed) {
      if (onApprove) onApprove(editedResponse);
    } else {
      updateState({ isEditing: false, isProofing: true, isProofed: false, isDismissed: false });
      setTimeout(() => {
        updateState({ isProofing: false, isProofed: true });
      }, 1500);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    if (urgency === 'high') return 'text-tertiary';
    if (urgency === 'medium') return 'text-amber-600';
    return 'text-zinc-500';
  };

  const getRiskBadge = (risk: string) => {
    const badges = {
      high: { label: 'HIGH RISK', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      medium: { label: 'MED RISK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      low: { label: 'LOW RISK', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    };
    return badges[risk as keyof typeof badges];
  };

  const handleReset = () => {
    updateState({ editedResponse: ticket.draftResponse, isEditing: false, isProofed: false, isDismissed: false });
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
              QUEUE <span className="text-zinc-400 mx-1">&gt;</span> {categoryName.toUpperCase()} <span className="text-zinc-400 mx-1">&gt;</span> {ticket.customerName.toUpperCase().slice(0, 15)}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Maximize/Restore Button */}
          <button
            className="text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 p-1 rounded transition-all"
            title={isExpanded ? "Exit expanded view (Esc)" : "Expand to full view"}
            onClick={onToggleExpand}
          >
            <span className="material-symbols-outlined !text-[18px]" data-icon={isExpanded ? "close_fullscreen" : "open_in_full"}>
              {isExpanded ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>

          {/* Close Button */}
          <button
            className="text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 p-1 rounded transition-all"
            title="Close"
            onClick={onBack}
          >
            <span className="material-symbols-outlined !text-[18px]" data-icon="close">close</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex-grow overflow-y-auto">
        {/* CUSTOMER INFO BAR (Compact View Only) */}
        {!isExpanded && (
          <>
            <div className="px-4 py-3 bg-surface-container-lowest border-b border-outline-variant">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="font-headline text-base font-semibold text-primary">
                {ticket.customerName}
              </h2>
              <p className="font-body text-xs text-on-surface-variant">
                {ticket.customerEmail}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className={`font-label text-[10px] font-bold ${getUrgencyColor(ticket.urgency)}`}>
                {ticket.urgency.toUpperCase()}
              </span>
              <span className="font-label text-[9px] text-zinc-400">
                Conf: {Math.round(ticket.confidence * 100)}%
              </span>
            </div>
          </div>
          <p className="font-body text-sm font-medium text-on-surface">
            {ticket.subject}
          </p>
        </div>

        {/* AI ANALYSIS SECTION */}
        <div className="px-4 py-3 border-b border-outline-variant">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              AI Analysis
            </h3>
            <span className={`font-label text-[9px] px-2 py-0.5 rounded border ${getRiskBadge(ticket.riskLevel).bg} ${getRiskBadge(ticket.riskLevel).text} ${getRiskBadge(ticket.riskLevel).border}`}>
              {getRiskBadge(ticket.riskLevel).label}
            </span>
          </div>
          <p className="font-body text-xs text-on-surface leading-relaxed">
            {ticket.aiSummary}
          </p>
          <div className="mt-2 flex items-start gap-2">
            <span className="material-symbols-outlined !text-[16px] text-tertiary mt-0.5" data-icon="lightbulb">
              lightbulb
            </span>
            <div className="flex-grow">
              <span className="font-label text-[9px] text-zinc-500 uppercase tracking-wide">
                Recommended
              </span>
              <p className="font-body text-xs text-on-surface mt-0.5">
                {ticket.recommendedAction}
              </p>
            </div>
          </div>
        </div>

        {/* ORIGINAL MESSAGE */}
        <div className="px-4 py-3 border-b border-outline-variant">
          <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500 mb-2">
            Original Message
          </h3>
          <div className="bg-surface-container-lowest p-3 rounded border border-outline-variant">
            <p className="font-body text-xs text-on-surface whitespace-pre-wrap leading-relaxed">
              {ticket.fullMessage}
            </p>
          </div>
        </div>
        </>
        )}

        {/* DRAFT RESPONSE */}
        <div className="px-4 py-3 flex-grow flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
              Draft Response
            </h3>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => navigator.clipboard.writeText(isEditing ? editedResponse : ticket.draftResponse)}
                className="p-1 text-zinc-400 hover:text-primary hover:bg-zinc-100 rounded transition-all"
                title="Copy draft"
              >
                 <span className="material-symbols-outlined !text-[18px]">content_copy</span>
              </button>
              {!isEditing && (
                <button
                  onClick={() => updateState({ isEditing: true })}
                  className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-all"
                  title="Modify draft"
                >
                  <span className="material-symbols-outlined !text-[18px]" data-icon="edit">edit</span>
                </button>
              )}
              {isEditing && (
                <button
                  onClick={handleReset}
                  className="text-[10px] text-zinc-500 hover:text-zinc-700 underline ml-1"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {isEditing ? (
            <textarea
              value={editedResponse}
              onChange={handleTextChange}
              className="w-full flex-grow min-h-[400px] p-4 bg-white border border-outline-variant rounded font-body text-sm text-on-surface leading-relaxed focus:outline-none focus:ring-2 focus:ring-tertiary focus:border-transparent resize-none"
            />
          ) : (
            <div className="flex-grow bg-surface-container-lowest p-4 rounded border border-outline-variant overflow-y-auto">
              <p className="font-body text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
                {ticket.draftResponse}
              </p>
            </div>
          )}


          {/* PROOFING SUGGESTIONS (Appears after Proofing completes) */}
          {isProofed && !isDismissed && (
            <div className="mt-4 relative p-4 bg-tertiary/5 border border-tertiary/20 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button 
                onClick={() => updateState({ isDismissed: true })}
                className="absolute top-3 right-3 p-1 text-tertiary/60 hover:text-tertiary hover:bg-tertiary/10 rounded-full transition-all"
                title="Dismiss suggestion"
              >
                <span className="material-symbols-outlined !text-[16px]">close</span>
              </button>
              <h4 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-tertiary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined !text-[16px]">check_circle</span>
                Proofing Suggestions
              </h4>
              <ul className="space-y-2 font-body text-sm text-on-surface">
                <li className="flex items-start gap-2">
                  <span className="text-tertiary">•</span>
                  <span>Tone refinement: Softened opening from <span className="text-zinc-500 line-through">I sincerely apologise</span> to <span className="text-tertiary font-medium">I am incredibly sorry</span></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-tertiary">•</span>
                  <span>Grammar: Ensures correct localized spelling conventions (UK/AU vs US).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-tertiary">•</span>
                  <span>Clarity alignment: Suggests splitting the third sentence to improve readability and cognitive drop-off.</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* ACTION FOOTER */}
      <footer className="px-4 py-3 bg-zinc-50 border-t border-outline-variant flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => updateState({ isEditing: !isEditing })}
            className={`flex-1 px-4 py-2.5 transition-all rounded font-label text-[11px] font-semibold ${
              isEditing
                ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                : 'bg-white border border-outline-variant hover:bg-zinc-50 text-zinc-700'
            }`}
          >
            {isEditing ? 'DONE EDITING' : 'EDIT'}
          </button>
          <button
            onClick={handleProofClick}
            disabled={isProofing || (isEditing && editedResponse.trim().length === 0)}
            className={`flex-1 px-4 py-2.5 bg-primary hover:bg-zinc-800 transition-all rounded font-label text-[11px] font-semibold text-white flex items-center justify-center gap-2 ${isProofing ? 'opacity-90 cursor-wait' : ''} ${(isEditing && editedResponse.trim().length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isProofing ? (
               <>
                 <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> PROOFING...
               </>
            ) : isProofed ? (
               'SEND'
            ) : (
              <>
                PROOF
                <span className="text-[9px] opacity-90 tabular-nums">({Math.round(ticket.confidence * 100)}%)</span>
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
