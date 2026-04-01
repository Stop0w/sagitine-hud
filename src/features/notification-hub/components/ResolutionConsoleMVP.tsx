// src/features/notification-hub/components/ResolutionConsoleMVP.tsx

import React, { useState } from 'react';
import type { HubTicketHydration, ProofState, ProofResponse, ProofApiResponse } from '../types/mvp';
import { ConsoleSharedState } from './ResolutionConsole'; // Kept for the parent Hub interface

interface ResolutionConsoleMVPProps {
  data: HubTicketHydration;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onBack: () => void;
  onApprove?: (finalText: string) => void;
  // sharedState and onSharedStateChange remain for interface signature, but are superseded by strict local MVP state.
  sharedState: ConsoleSharedState;
  onSharedStateChange: (state: ConsoleSharedState) => void;
}

export function ResolutionConsoleMVP({
  data,
  isExpanded = false,
  onToggleExpand,
  onBack,
  onApprove,
  sharedState,
  onSharedStateChange,
}: ResolutionConsoleMVPProps) {
  const { ticket, customer, message, triage, ui, strategy } = data;
  
  const requiresApproval = strategy?.requiresManagementApproval === true;
  
  // Strict MVP Local State Machine
  const [proofState, setProofState] = useState<ProofState>('not_proofed');
  const [proofResult, setProofResult] = useState<ProofResponse | null>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedResponse, setEditedResponse] = useState<string>(triage.draftResponse || '');
  const [hasEverBeenEdited, setHasEverBeenEdited] = useState(false);
  const [lastProofedDraft, setLastProofedDraft] = useState<string>('');
  
  // 1. Invalidation Flow
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setEditedResponse(newText);
    setHasEverBeenEdited(true);

    // If we are currently proofed, check if the text drifted from the official corrected draft
    if (proofState === 'proofed' && newText !== lastProofedDraft) {
      setProofState('invalidated');
    }
  };

  const handleEditToggle = () => {
    // If it was collapsed and user is opening editor, we initialize if empty
    if (!isEditing && !editedResponse) {
      setEditedResponse(triage.draftResponse || '');
    }
    setIsEditing(!isEditing);
  };

  // 2. Draft Provenance Derivation
  const getProvenanceLabel = () => {
    if (proofState === 'proofed') return { text: '✨ Proofed & Ready', bg: 'bg-green-100/80 text-green-700 border-green-200' };
    if (proofState === 'invalidated') return { text: '⚠️ Edited After Proof', bg: 'bg-amber-100/80 text-amber-700 border-amber-200' };
    if (hasEverBeenEdited) return { text: '✏️ Human Edited', bg: 'bg-zinc-100 text-zinc-600 border-zinc-200' };
    return { text: '🤖 AI Draft', bg: 'bg-blue-50 text-blue-600 border-blue-100' };
  };

  // 3. Network Calls
  const apiSubmitProof = async (text: string): Promise<ProofApiResponse> => {
    // Development-only mock fallback (Must strictly fail or hit real API in production)
    // @ts-ignore
    if (import.meta.env.DEV && import.meta.env.VITE_MOCK_PROOFING === 'true') {
      return new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        data: {
          proofStatus: "proofed",
          changesDetected: true,
          correctedDraft: text.replace('Warm regards, Warm regards,', 'Warm regards,'),
          suggestions: [
            { type: 'grammar', severity: 'medium', message: 'Removed duplicate sign-off.' },
            { type: 'tone', severity: 'low', message: 'Adjusted empathy in opening sentence.' }
          ],
          summary: { tone: 'fixes_applied', grammar: 'fixes_applied', clarity: 'pass', risk: 'low' },
          proofedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      }), 1500));
    }

    // Production explicit fetch
    const response = await fetch(`/api/hub/ticket/${ticket.id}/proof`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftText: text, operatorEdited: hasEverBeenEdited })
    });
    
    if (!response.ok) throw new Error('Proofing endpoint failed');
    return response.json();
  };
  
  const apiSubmitApproval = async (finalText: string) => {
    // Development-only mock fallback
    // @ts-ignore
    if (import.meta.env.DEV && import.meta.env.VITE_MOCK_PROOFING === 'true') {
      return new Promise((resolve) => setTimeout(resolve, 1200));
    }
    
    // Production explicit send logic
    const response = await fetch(`/api/tickets/${ticket.id}/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_message_sent: finalText })
    });
    
    if (!response.ok) throw new Error('Send dispatch failed');
    return response.json();
  };

  const executeProof = async () => {
    const payloadText = editedResponse || triage.draftResponse || '';
    
    setProofState('proofing');
    setIsEditing(false); // Close editor visually to show diff

    try {
      const apiResponse = await apiSubmitProof(payloadText);
      const { success, data } = apiResponse;
      
      // Strict Proof validation rule
      if (success === true && (data.proofStatus === 'proofed' || data.proofStatus === 'warning')) {
        // Immediate strict hydration
        setEditedResponse(data.correctedDraft);
        setLastProofedDraft(data.correctedDraft);
        setProofResult(data);
        setProofState('proofed');
      } else {
        // Invalidated by explicit backend error status or missing success flag
        setProofState('not_proofed');
      }
    } catch (error) {
      console.error(error);
      setProofState('not_proofed');
    }
  };

  const executeSend = async () => {
    if (proofState !== 'proofed') return; // Strict guard
    
    const finalPayload = editedResponse; // MUST be exactly what is in the editor
    
    setProofState('sending');
    try {
      await apiSubmitApproval(finalPayload);
      if (onApprove) onApprove(finalPayload);
    } catch(e) {
      setProofState('send_failed');
    }
  };

  const handleActionClick = () => {
    if (proofState === 'proofed') {
      executeSend();
    } else {
      executeProof();
    }
  };

  const handleReset = () => {
    setEditedResponse(triage.draftResponse || '');
    setHasEverBeenEdited(false);
    setProofState('not_proofed');
    setProofResult(null);
  };

  // Helpers
  const getUrgencyColor = (urgency: number) => {
    if (urgency >= 8) return 'text-tertiary';
    if (urgency >= 5) return 'text-amber-600';
    return 'text-zinc-500';
  };

  const getRiskBadge = (risk: string) => {
    const badges = {
      high: { label: 'HIGH RISK', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
      medium: { label: 'MED RISK', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      low: { label: 'LOW RISK', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    };
    return badges[risk as keyof typeof badges] || badges.low;
  };

  const displayName = customer.name?.trim() || customer.email.split('@')[0] || "Customer";
  const provenance = getProvenanceLabel();

  return (
    <div className="flex flex-col h-full bg-white">
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
              QUEUE <span className="text-zinc-400 mx-1">&gt;</span> {ticket.categoryLabel.toUpperCase()} <span className="text-zinc-400 mx-1">&gt;</span> {displayName.toUpperCase().slice(0, 15)}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200 p-1 rounded transition-all"
            title={isExpanded ? "Exit expanded view (Esc)" : "Expand to full view"}
            onClick={onToggleExpand}
          >
            <span className="material-symbols-outlined !text-[18px]" data-icon={isExpanded ? "close_fullscreen" : "open_in_full"}>
              {isExpanded ? 'close_fullscreen' : 'open_in_full'}
            </span>
          </button>
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
      <div className={`flex-grow flex ${isExpanded ? 'flex-row overflow-hidden' : 'flex-col overflow-y-auto'}`}>
        
        {/* LEFT COLUMN - CRM & CONTEXT (Expanded View Only) */}
        {isExpanded && (
          <div className="w-[300px] flex-shrink-0 bg-surface-container-lowest border-r border-outline-variant flex flex-col h-full overflow-y-auto">
            {/* Identity Block */}
            <div className="px-5 py-6 border-b border-outline-variant relative">
              <h2 className="font-headline text-2xl font-semibold tracking-tight text-primary mb-1">
                {displayName}
              </h2>
              <div className="flex items-center gap-1.5 text-on-surface-variant mb-3">
                <span className="material-symbols-outlined !text-[14px]">mail</span>
                <p className="font-body text-xs">{customer.email}</p>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {customer.isRepeatContact && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-label text-[9px] font-bold uppercase tracking-wider border border-blue-100">
                    <span className="material-symbols-outlined !text-[12px]">repeat</span>
                    Repeat Customer
                  </span>
                )}
                {customer.isHighAttentionCustomer && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-label text-[9px] font-bold uppercase tracking-wider border border-purple-100">
                    <span className="material-symbols-outlined !text-[12px]">priority_high</span>
                    High Attention
                  </span>
                )}
              </div>
            </div>

            {/* Account Stats Block */}
            <div className="px-5 py-4 border-b border-outline-variant">
              <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500 mb-3">
                Account Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-on-surface-variant font-medium">Total Contacts</span>
                  <span className="font-body text-sm font-semibold text-primary">{customer.totalContactCount}</span>
                </div>
                {ui.showThirtyDayVolume && (
                  <div className="flex justify-between items-center">
                    <span className="font-body text-xs text-on-surface-variant font-medium">30-Day Volume</span>
                    <span className="font-body text-sm font-semibold text-primary">{customer.thirtyDayVolume}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-body text-xs text-on-surface-variant font-medium">Last Contact</span>
                  <span className="font-body text-sm font-semibold text-primary">
                    {customer.lastContactAt ? new Date(customer.lastContactAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Never'}
                  </span>
                </div>

                {/* Optional Nullable Extracted Fields */}
                {customer.lastContactCategory && (
                  <div className="flex justify-between items-center">
                    <span className="font-body text-xs text-on-surface-variant font-medium">Last Category</span>
                    <span className="font-body text-xs font-semibold text-primary">{customer.lastContactCategory}</span>
                  </div>
                )}
                {customer.patternSummary && (
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="font-body text-xs text-on-surface-variant font-medium">Pattern</span>
                    <span className="font-body text-[11px] font-semibold text-primary leading-tight">{customer.patternSummary}</span>
                  </div>
                )}

                {/* Shopify Enrichment */}
                {customer.shopifyOrderCount !== null && (
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-outline-variant">
                    <span className="font-body text-xs text-blue-800 font-medium">Total Orders</span>
                    <span className="font-body text-sm font-semibold text-blue-900">{customer.shopifyOrderCount}</span>
                  </div>
                )}
                {customer.shopifyLtv !== null && (
                  <div className="flex justify-between items-center">
                    <span className="font-body text-xs text-blue-800 font-medium">Lifetime Value</span>
                    <span className="font-body text-sm font-semibold text-blue-900">${customer.shopifyLtv.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Current Inquiry Metadata */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-zinc-500">
                  Current Inquiry
                </h3>
              </div>
              <div className="bg-white rounded border border-outline-variant p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-label text-[10px] text-zinc-500">CATEGORY</span>
                  <span className="font-label text-[10px] font-bold text-zinc-700">{ticket.categoryLabel}</span>
                </div>
                {ticket.waitingMinutes !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="font-label text-[10px] text-zinc-500">WAIT TIME</span>
                    <span className="font-label text-[10px] font-bold text-zinc-700">{ticket.waitingMinutes} min</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-label text-[10px] text-zinc-500">URGENCY</span>
                  <span className={`font-label text-[10px] font-bold ${getUrgencyColor(ticket.urgency)}`}>
                    {ticket.urgency}/10
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-label text-[10px] text-zinc-500">CONFIDENCE</span>
                  <span className="font-label text-[10px] font-bold text-zinc-700">
                    {Math.round(ticket.confidence * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-label text-[10px] text-zinc-500">RISK LEVEL</span>
                  <span className={`font-label text-[9px] px-1.5 py-0.5 rounded border ${getRiskBadge(ticket.riskLevel).bg} ${getRiskBadge(ticket.riskLevel).text} ${getRiskBadge(ticket.riskLevel).border}`}>
                    {ticket.riskLevel.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Outlook Button */}
            <div className="px-5 mt-auto pb-6 pt-4">
              <button className="w-full py-2.5 px-4 bg-white border border-[#0078D4] text-[#0078D4] hover:bg-[#0078D4]/5 rounded font-label text-[11px] font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-2 group shadow-sm">
                Open in Outlook
                <span className="material-symbols-outlined !text-[14px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">north_east</span>
              </button>
            </div>
          </div>
        )}

        {/* MIDDLE COLUMN - ORIGINAL MESSAGE & AI ANALYSIS */}
        <div className={`${isExpanded ? 'w-[400px] border-r border-outline-variant flex-shrink-0 overflow-y-auto' : 'flex-none'}`}>
          {!isExpanded && (
            <div className="px-4 py-3 bg-surface-container-lowest border-b border-outline-variant">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="font-headline text-base font-semibold text-primary">
                    {displayName}
                  </h2>
                  <p className="font-body text-xs text-on-surface-variant">
                    {customer.email}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`font-label text-[10px] font-bold ${getUrgencyColor(ticket.urgency)}`}>
                    URGENCY {ticket.urgency}
                  </span>
                  <span className="font-label text-[9px] text-zinc-400">
                    Conf: {Math.round(ticket.confidence * 100)}%
                  </span>
                </div>
              </div>
              <p className="font-body text-sm font-medium text-on-surface">
                {message.subject}
              </p>
            </div>
          )}

          {/* AI ANALYSIS SECTION */}
          <div className="px-4 py-4 border-b border-outline-variant bg-zinc-50/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-bold text-zinc-600">
                  AI Triage Analysis
                </h3>
                {requiresApproval && (
                  <span className="font-label text-[9px] px-1.5 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200 uppercase font-bold tracking-wider">
                    Approval Required
                  </span>
                )}
              </div>
              {!isExpanded && (
                <span className={`font-label text-[9px] px-2 py-0.5 rounded border ${getRiskBadge(ticket.riskLevel).bg} ${getRiskBadge(ticket.riskLevel).text} ${getRiskBadge(ticket.riskLevel).border}`}>
                  {getRiskBadge(ticket.riskLevel).label}
                </span>
              )}
            </div>
            <p className="font-body text-[13px] text-on-surface leading-relaxed mb-4">
              {triage.aiSummary}
            </p>
            <div className="bg-white border border-tertiary/20 rounded pl-3 pr-4 py-3 flex flex-col items-start shadow-sm shadow-tertiary/5">
              <div className="flex items-start gap-3 w-full">
                <span className="material-symbols-outlined !text-[18px] text-tertiary mt-0.5" data-icon="lightbulb">
                  lightbulb
                </span>
                <div className="flex-grow">
                  <span className="font-label text-[9px] text-tertiary uppercase tracking-wider font-bold block mb-1">
                    Recommended Action
                  </span>
                  <p className="font-body text-[13px] text-on-surface">
                    {ticket.recommendedNextAction}
                  </p>
                </div>
              </div>

              {requiresApproval && strategy.managementEscalationReason && (
                <div className="w-full mt-3 pt-3 border-t border-amber-500/10 flex items-start gap-3">
                  <span className="material-symbols-outlined !text-[16px] text-amber-600 mt-0.5">policy</span>
                  <div>
                    <span className="font-label text-[9px] text-amber-700 uppercase tracking-wider font-bold block mb-0.5">Escalation Reason</span>
                    <p className="font-body text-[12px] text-amber-900 leading-tight">{strategy.managementEscalationReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ORIGINAL MESSAGE */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-bold text-zinc-600">
                Original Message
              </h3>
            </div>
            <div className="p-4 rounded border border-outline-variant bg-surface-container-lowest shadow-inner">
              <div className="flex items-start justify-between mb-3 pb-3 border-b border-outline-variant/60">
                <h4 className="font-body text-sm font-bold text-primary max-w-[80%] line-clamp-2 leading-tight">
                  {message.subject}
                </h4>
                <span className="font-label text-[9px] text-zinc-400 mt-1 whitespace-nowrap">
                  {new Date(ticket.receivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
              <p className="font-body text-[13px] text-on-surface whitespace-pre-wrap leading-relaxed">
                {message.fullMessage}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - DRAFT RESPONSE */}
        <div className={`flex-grow flex flex-col bg-white ${isExpanded ? 'min-h-0' : 'min-h-[500px]'}`}>
          <div className="px-4 py-3 flex items-center justify-between border-y border-outline-variant bg-zinc-50">
            <div className="flex items-center gap-3">
              <h3 className="font-label text-[10px] tracking-[0.15em] uppercase font-bold text-zinc-600 flex items-center gap-2">
                <span className="material-symbols-outlined !text-[16px] text-zinc-400" data-icon="edit_document">edit_document</span>
                Draft Response
              </h3>
              
              {/* Draft Provenance State Chip */}
              <div className={`px-2 py-0.5 rounded border font-label text-[9px] font-bold uppercase tracking-wider ${provenance.bg} transition-colors duration-300`}>
                {provenance.text}
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button 
                onClick={() => navigator.clipboard.writeText(editedResponse || triage.draftResponse || '')}
                className="p-1.5 text-zinc-400 hover:text-primary hover:bg-zinc-200 rounded transition-all"
                title="Copy current draft"
              >
                 <span className="material-symbols-outlined !text-[16px]">content_copy</span>
              </button>
              {!isEditing && (
                <button
                  onClick={handleEditToggle}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200 rounded transition-all"
                  title="Modify draft"
                >
                  <span className="material-symbols-outlined !text-[16px]" data-icon="edit">edit</span>
                </button>
              )}
              {isEditing && (
                <button
                  onClick={handleReset}
                  className="px-2 py-1 ml-1 text-[10px] font-label font-semibold text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded transition-colors uppercase tracking-wider"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="flex-grow p-4 overflow-y-auto">
            {isEditing ? (
              <textarea
                value={editedResponse}
                onChange={handleTextChange}
                className="w-full h-[300px] p-4 bg-white border border-tertiary/40 rounded-md font-body text-[14px] text-on-surface leading-relaxed focus:outline-none focus:ring-2 focus:ring-tertiary/70 focus:border-transparent resize-none shadow-sm"
              />
            ) : (
              <div className="min-h-[250px] bg-white p-4 rounded-md border border-outline-variant overflow-y-auto font-body text-[14px] text-on-surface whitespace-pre-wrap leading-relaxed shadow-sm">
                {editedResponse || triage.draftResponse}
              </div>
            )}
            
            {/* Backend Data-Driven Proofing Results */}
            {proofState === 'proofed' && proofResult && (
              <>
                {proofResult.suggestions && proofResult.suggestions.length > 0 ? (
                  <div className="mt-4 relative p-4 bg-tertiary/5 border border-tertiary/20 rounded-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <h4 className="font-label text-[10px] tracking-[0.15em] uppercase font-semibold text-tertiary mb-3 flex items-center gap-1.5">
                      <span className="material-symbols-outlined !text-[16px]">check_circle</span>
                      Proofing Complete
                    </h4>
                    
                    {proofResult.changesDetected && (
                      <p className="font-body text-xs italic text-zinc-500 mb-3 border-b border-tertiary/10 pb-2">
                        Corrections automatically applied to your draft:
                      </p>
                    )}
                    
                    {proofResult.summary && (
                      <div className="flex gap-2 mb-3">
                        {Object.entries(proofResult.summary).map(([key, val]) => {
                          if (key === 'risk') return null;
                          const color = val === 'warning' ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                                        val === 'fixes_applied' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                        'bg-green-50 text-green-700 border-green-200';
                          return (
                            <span key={key} className={`px-2 py-0.5 rounded border font-label text-[9px] font-bold uppercase tracking-wider ${color}`}>
                              {key}: {val.replace('_', ' ')}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    
                    <ul className="space-y-2 font-body text-xs text-on-surface">
                      {proofResult.suggestions.map((suggestion, idx) => {
                        const renderKey = `${idx}-${suggestion.type}-${suggestion.message}`;
                        return (
                        <li key={renderKey} className="flex items-start gap-2">
                          <span className={`material-symbols-outlined !text-[14px] mt-0.5 ${
                              suggestion.severity === 'high' ? 'text-red-500' : 
                              suggestion.severity === 'medium' ? 'text-amber-500' : 'text-tertiary'
                            }`}>
                            {suggestion.severity === 'high' ? 'error' : suggestion.severity === 'medium' ? 'warning' : 'tips_and_updates'}
                          </span>
                          <div>
                            <span className="font-semibold text-zinc-700 uppercase tracking-wider text-[10px] mr-1">
                              [{suggestion.type}]
                            </span>
                            <span>{suggestion.message}</span>
                          </div>
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-green-50/50 border border-green-200 rounded animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-center gap-2 text-green-800">
                    <span className="material-symbols-outlined !text-[18px]">verified</span>
                    <p className="font-body text-sm font-medium">Automatic proofing complete. No issues detected.</p>
                  </div>
                )}
              </>
            )}

            {proofState === 'send_failed' && (
               <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 flex items-center gap-2">
                 <span className="material-symbols-outlined !text-[18px]">error</span>
                 <p className="font-body text-sm font-medium">Failed to dispatch resolution payload. Please try again.</p>
               </div>
            )}
          </div>

          {/* ACTION FOOTER */}
          <footer className="px-4 py-3 bg-zinc-50 border-t border-outline-variant flex-shrink-0 mt-auto">
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleEditToggle}
                className={`flex-1 px-4 py-2.5 transition-all rounded font-label text-[11px] font-bold tracking-wide uppercase ${
                  isEditing
                    ? 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800 border-transparent shadow-inner'
                    : 'bg-white border border-outline-variant hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                {isEditing ? 'Done Editing' : 'Edit Response'}
              </button>
              <button
                onClick={handleActionClick}
                disabled={proofState === 'proofing' || proofState === 'sending' || (editedResponse.trim().length === 0) || (proofState === 'proofed' && requiresApproval)}
                className={`flex-1 px-4 py-2.5 transition-all rounded font-label text-[11px] font-bold tracking-wide uppercase text-white flex items-center justify-center gap-2 
                  ${(proofState === 'proofed' && requiresApproval) ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed' : proofState === 'proofed' ? 'bg-[#0078D4] hover:bg-[#006CBE]' : 'bg-primary hover:bg-primary/90'}
                  ${(proofState === 'proofing' || proofState === 'sending') ? 'opacity-90 cursor-wait' : ''} 
                  ${(editedResponse.trim().length === 0) ? 'opacity-50 cursor-not-allowed text-white/50 bg-zinc-400' : ''}
                `}
              >
                {proofState === 'sending' ? (
                  <>
                     <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> SENDING...
                  </>
                ) : proofState === 'proofing' ? (
                   <>
                     <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> PROOFING...
                   </>
                ) : proofState === 'proofed' ? (
                   <>
                     <span className="material-symbols-outlined !text-[16px]">send</span>
                     SEND RESPONSE
                   </>
                ) : (
                  <>
                    <span className="material-symbols-outlined !text-[16px]">spellcheck</span>
                    PROOF & REVIEW
                  </>
                )}
              </button>
            </div>
            
            {/* Contextual instruction */}
            <div className="text-center mt-2 h-4">
              <p className="font-label text-[9px] text-zinc-400 uppercase tracking-widest">
                {requiresApproval && proofState === 'proofed' ? "This ticket requires management approval before sending." :
                 proofState === 'sending' ? "Logging audit trail to backend..." : 
                 proofState === 'invalidated' ? "Changes detected. Reproof thoroughly before sending." :
                 proofState === 'proofed' ? "Ready for dispatch" : 
                 "Must be proofed securely before sending"}
              </p>
            </div>
          </footer>
        </div>
        
      </div>
    </div>
  );
}
