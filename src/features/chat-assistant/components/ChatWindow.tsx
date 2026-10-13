'use client';

import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Character } from './Character';
import type { Message, CharacterState } from '../hooks/useChatAssistant';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/* ── Simple markdown renderer for chat messages ── */
function formatMessage(text: string): ReactNode[] {
    return text.split('\n').map((line, lineIdx) => {
        // Split by **bold** segments
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formatted = parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={partIdx} className="font-semibold">{part.slice(2, -2)}</strong>;
            }
            return part;
        });

        return (
            <span key={lineIdx}>
                {lineIdx > 0 && <br />}
                {formatted}
            </span>
        );
    });
}

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    characterState: CharacterState;
    onSendMessage: (message: string) => void;
    onClose: () => void;
    onClear: () => void;
    onSuggestion?: (suggestion: string) => void;
    suggestions?: readonly string[];
    analysis?: readonly string[];
    mode?: 'quick' | 'deep';
    onModeChange?: (mode: 'quick' | 'deep') => void;
    scan?: {
        label: string;
        placeholder: string;
        value: string;
        pending?: boolean;
        error?: string;
        onChange: (value: string) => void;
        onSubmit: () => void;
    };
    lead?: {
        label: string;
        phoneLabel: string;
        consentLabel: string;
        submitLabel: string;
        value: string;
        consent: boolean;
        pending?: boolean;
        error?: string;
        success?: string;
        onChange: (value: string) => void;
        onConsentChange: (value: boolean) => void;
        onSubmit: () => void;
    };
    className?: string;
    scanDetails?: {
        sources: readonly { id?: string; url: string; status?: string; checkedAt?: string; excerpt?: string; recordType?: string }[];
        observations?: readonly { sourceId?: string; quote: string }[];
        aiStatus?: string;
        labels: { summary: string; status: Record<string, string>; recordType: Record<string, string>; boundary: string };
    };
    t: {
        title: string;
        online: string;
        placeholder: string;
        clear: string;
        close: string;
        quickServices: string;
        quickPricing: string;
        quickContact: string;
        quickHow: string;
        send?: string;
        auditMode?: string;
        labels?: { quick?: string; deep?: string; analysis?: string; suggestions?: string; check?: string; loading?: string; send?: string };
    };
}

export function ChatWindow({
    messages, isLoading, characterState, onSendMessage, onClose, onClear, onSuggestion, suggestions = [], analysis = [], mode, onModeChange, scan, lead, className, scanDetails, t,
}: ChatWindowProps) {
    const [input, setInput] = useState('');
    const messagesRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        if (messagesRef.current) {
            messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        onSendMessage(trimmed);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleQuickAction = (label: string) => {
        onSendMessage(label);
    };

    const showQuickActions = messages.length === 1 && messages[0].id === 'welcome' && !isLoading;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`absolute bottom-20 right-0 flex h-[520px] max-h-[70vh] w-[380px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-2xl border border-border/50 bg-background shadow-2xl sm:max-w-[calc(100vw-2rem)] ${className ?? ''}`}
            data-aiaudit-responsive-dialog="true"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 gradient-bg">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                        <Character state={characterState} size={28} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">{t.title}</h3>
                        <span className="flex items-center gap-1.5 text-[10px] text-white/70">
                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                            {t.online}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onClear}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        title={t.clear}
                        aria-label={t.clear}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M8 16H3v5" />
                        </svg>
                    </button>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label={t.close}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {mode && onModeChange ? (
                <div className="flex gap-2 border-b border-border/50 bg-card/30 px-3 py-2" aria-label={t.auditMode ?? 'Audit mode'}>
                    {(['quick', 'deep'] as const).map((item) => (
                        <button key={item} type="button" onClick={() => onModeChange(item)} aria-pressed={mode === item} className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${mode === item ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border/50 text-muted-foreground'}`}>
                            {item === 'quick' ? (t.labels?.quick ?? 'Quick Audit') : (t.labels?.deep ?? 'Deep · one process')}
                        </button>
                    ))}
                </div>
            ) : null}

            {/* Messages */}
            <div ref={messagesRef} className="flex flex-1 flex-col overflow-y-auto p-4 chat-messages-scroll">
                <div className="flex-1" />
                {messages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`mb-3 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-bot'
                            }`}
                        >
                            {msg.content ? formatMessage(msg.content) : (
                                <span className="typing-indicator">
                                    <span /><span /><span />
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}

                {analysis.length > 0 ? (
                    <details className="mb-3 rounded-xl border border-border/50 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium">{t.labels?.analysis ?? 'Analysis details'}</summary>
                        <ul className="mt-2 list-disc space-y-1 pl-4">{analysis.map((item) => <li key={item}>{item}</li>)}</ul>
                    </details>
                ) : null}

                {suggestions.length > 0 && onSuggestion ? (
                    <div className="mb-3 flex flex-wrap gap-2" aria-label={t.labels?.suggestions ?? 'Suggested next steps'}>
                        {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} disabled={isLoading} className="rounded-xl border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-50">{suggestion}</button>)}
                    </div>
                ) : null}

                {scanDetails ? (
                    <details className="mb-3 rounded-xl border border-border/50 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-medium">{scanDetails.labels.summary}</summary>
                        <div className="mt-2 space-y-2">
                            {scanDetails.sources.map((source) => <div key={`${source.id ?? source.url}-${source.checkedAt ?? ''}`} className="rounded-lg border border-border/40 p-2"><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-primary">{source.url}</a><div className="mt-1 text-[10px]">{source.id ?? 'source'} · {source.status ? (scanDetails.labels.status[source.status] ?? source.status) : 'unknown'}{source.recordType ? ` · ${scanDetails.labels.recordType[source.recordType] ?? source.recordType}` : ''}</div>{source.excerpt ? <p className="mt-1 whitespace-pre-wrap leading-4">{source.excerpt}</p> : null}</div>)}
                            {scanDetails.observations?.length ? <ul className="list-disc space-y-1 pl-4">{scanDetails.observations.map((item, index) => <li key={`${item.sourceId ?? 'observation'}-${index}`}>{item.quote}{item.sourceId ? ` [${item.sourceId}]` : ''}</li>)}</ul> : null}
                            <p className="border-l-2 border-primary/30 pl-2 text-[11px]">{scanDetails.labels.boundary}</p>
                        </div>
                    </details>
                ) : null}

                {/* Typing indicator */}
                <AnimatePresence>
                    {isLoading && messages[messages.length - 1]?.content !== '' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="mb-3 flex justify-start"
                        >
                            <div className="chat-bubble-bot rounded-2xl px-4 py-2.5">
                                <span className="typing-indicator">
                                    <span /><span /><span />
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Quick actions */}
                {showQuickActions && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-2 flex flex-wrap gap-2"
                    >
                        {[
                            { label: t.quickServices, icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
                            { label: t.quickPricing, icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
                            { label: t.quickContact, icon: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z' },
                            { label: t.quickHow, icon: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01' },
                        ].map((action, i) => (
                            <motion.button
                                key={action.label}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.4 + i * 0.08 }}
                                onClick={() => handleQuickAction(action.label)}
                                className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition duration-200 hover:border-primary/30 hover:text-foreground"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                                    <path d={action.icon} />
                                </svg>
                                {action.label}
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </div>

            {/* Input */}
            <div className="border-t border-border/50 bg-card/30 p-3">
                {scan ? (
                    <details className="mb-2 rounded-xl border border-border/50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{scan.label}</summary>
                        <div className="mt-2 flex gap-2">
                            <Input value={scan.value} onChange={(event) => scan.onChange(event.target.value)} placeholder={scan.placeholder} className="min-w-0 flex-1 rounded-xl text-xs" />
                            <Button type="button" variant="outline" size="sm" onClick={scan.onSubmit} disabled={scan.pending || !scan.value.trim()}>{scan.pending ? (t.labels?.loading ?? '…') : (t.labels?.check ?? 'Check')}</Button>
                        </div>
                        {scan.error ? <p role="alert" className="mt-2 text-xs text-destructive">{scan.error}</p> : null}
                    </details>
                ) : null}
                {lead ? (
                    <details className="mb-2 rounded-xl border border-border/50 px-3 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{lead.label}</summary>
                        <div className="mt-2 space-y-2">
                            <label className="block text-xs text-muted-foreground">{lead.phoneLabel}<Input value={lead.value} onChange={(event) => lead.onChange(event.target.value)} inputMode="tel" className="mt-1 w-full rounded-xl text-xs" /></label>
                            <label className="flex gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={lead.consent} onChange={(event) => lead.onConsentChange(event.target.checked)} />{lead.consentLabel}</label>
                            <Button type="button" variant="outline" size="sm" onClick={lead.onSubmit} disabled={lead.pending || !lead.value.trim() || !lead.consent}>{lead.pending ? '…' : lead.submitLabel}</Button>
                            {lead.error ? <p role="alert" className="text-xs text-destructive">{lead.error}</p> : null}
                            {lead.success ? <p role="status" className="text-xs text-emerald-600">{lead.success}</p> : null}
                        </div>
                    </details>
                ) : null}
                <div className="flex items-center gap-2">
                    <label htmlFor="ainow-assistant-input" className="sr-only">
                        {t.placeholder}
                    </label>
                    <input
                        id="ainow-assistant-input"
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t.placeholder}
                        disabled={isLoading}
                        aria-label={t.placeholder}
                        data-mcp-toolname="ainow-assistant-input"
                        data-mcp-tooldescription="Type a question for the aiNOW website assistant"
                        className="flex-1 rounded-xl border border-border/50 bg-background/50 px-4 py-2.5 text-sm outline-none transition-colors duration-200 placeholder:text-muted-foreground/60 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
                    />
                    <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            handleSend();
                            inputRef.current?.focus();
                        }}
                        disabled={isLoading || !input.trim()}
                        className="gradient-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-primary/20 transition duration-200 hover:opacity-90 hover:shadow-lg hover:shadow-primary/30 active:scale-95 disabled:opacity-40 disabled:shadow-none"
                        aria-label={t.send ?? 'Send'}
                        data-mcp-toolname="ainow-assistant-send"
                        data-mcp-tooldescription="Send the typed message to the aiNOW assistant"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
