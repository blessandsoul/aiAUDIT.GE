'use client';

import { Ico } from '@/components/common/Ico';
import { ChannelScannerModal, VoiceIntakeButton } from './intake-tools';
import { AiIntakeLeadDialog } from './AiIntakeLeadDialog';
import {
  HeroIntakeConversation,
  type ConversationMessage,
} from './HeroIntakeConversation';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MessageSquare, Target, FileText, Zap, ChevronDown } from 'lucide-react';
import { BorderBeam } from 'border-beam';
import type { IntakeState } from '@/lib/ai-intake-controller';

import './hero-ai-chat.css';

/* Color interpolation helpers ported from iAI OS */
function parseOrbHex(value: string) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  const numeric = Number.parseInt(match[1], 16);
  return [((numeric >> 16) & 255) / 255, ((numeric >> 8) & 255) / 255, (numeric & 255) / 255] as const;
}

function orbRgbToHsl([red, green, blue]: readonly number[]) {
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return [0, 0, lightness] as const;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [((hue * 60) + 360) % 360, saturation, lightness] as const;
}

function orbHslToHex(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  let color = [0, 0, 0];
  if (segment < 1) color = [chroma, secondary, 0];
  else if (segment < 2) color = [secondary, chroma, 0];
  else if (segment < 3) color = [0, chroma, secondary];
  else if (segment < 4) color = [0, secondary, chroma];
  else if (segment < 5) color = [secondary, 0, chroma];
  else color = [chroma, 0, secondary];
  const match = lightness - chroma / 2;
  return `#${color.map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function interpolateOrbAccent(from: string, to: string, progress: number) {
  const startRgb = parseOrbHex(from);
  const endRgb = parseOrbHex(to);
  if (!startRgb || !endRgb) return to;
  const start = orbRgbToHsl(startRgb);
  const end = orbRgbToHsl(endRgb);
  const hueDelta = ((end[0] - start[0] + 540) % 360) - 180;
  return orbHslToHex(
    (start[0] + hueDelta * progress + 360) % 360,
    start[1] + (end[1] - start[1]) * progress,
    start[2] + (end[2] - start[2]) * progress,
  );
}

/* Liquid Agent Orb WebGL Component from iAI */
export function HeroLiquidOrb({
  accent,
  fromAccent = accent,
}: {
  accent: string;
  fromAccent?: string;
}) {
  const orbRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [initialFrameSrc] = useState(() => `/liquid-orb.html?accent=${encodeURIComponent(accent)}&from=${encodeURIComponent(fromAccent)}`);
  const [renderState, setRenderState] = useState<"loading" | "ready" | "fallback">("loading");
  const reduceMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const element = orbRef.current;
    if (!element) return;
    if (reduceMotion || fromAccent === accent) {
      element.style.setProperty("--orb-accent", accent);
      return;
    }
    const orbElement = element;
    const startedAt = performance.now();
    let frame = 0;
    function update(now: number) {
      const linear = Math.min(1, Math.max(0, (now - startedAt) / 900));
      const eased = linear * linear * (3 - 2 * linear);
      orbElement.style.setProperty("--orb-accent", interpolateOrbAccent(fromAccent, accent, eased));
      if (linear < 1) frame = window.requestAnimationFrame(update);
    }
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [accent, fromAccent, reduceMotion]);

  useEffect(() => {
    function handleOrbMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.source !== "iai-liquid-orb") return;
      if (event.data.status === "ready") setRenderState("ready");
      if (event.data.status === "error") setRenderState("fallback");
    }

    window.addEventListener("message", handleOrbMessage);
    return () => window.removeEventListener("message", handleOrbMessage);
  }, []);

  useEffect(() => {
    if (renderState !== "ready") return;
    frameRef.current?.contentWindow?.postMessage({
      source: "iai-liquid-orb-host",
      accent,
      fromAccent,
    }, window.location.origin);
  }, [accent, fromAccent, renderState]);

  return (
    <span
      ref={orbRef}
      className="heroLiquidOrb"
      data-render-state={renderState}
      style={{ "--orb-accent": fromAccent } as CSSProperties}
      aria-hidden="true"
    >
      {renderState !== "ready" ? (
        <span key="orb-fallback" className="heroLiquidOrbFallback" />
      ) : null}
      <iframe
        key="orb-frame"
        ref={frameRef}
        className="heroLiquidOrbFrame"
        src={initialFrameSrc}
        title="Animated AI Liquid Orb"
        tabIndex={-1}
      />
    </span>
  );
}

export function HeroAiChat() {
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('');
  const orbAccent = '#4f46e5';
  const [isChatMode, setIsChatMode] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [intakeState, setIntakeState] = useState<IntakeState | null>(null);
  const [isIntakeLoading, setIsIntakeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [heroScrolled, setHeroScrolled] = useState(false);
  const intakeAbortRef = useRef<AbortController | null>(null);
  const finalAssistantIdRef = useRef<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerTopBeforeChatRef = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => setHeroScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.localStorage.removeItem('aiaudit-hero-brief-draft');
  }, []);

  // Keep the page scrollable. The conversation lives in the hero instead of a modal.
  useEffect(() => {
    if (isChatMode) {
      document.body.classList.add('hero-conversation-active');
    } else {
      document.body.classList.remove('hero-conversation-active');
    }
    return () => {
      document.body.classList.remove('hero-conversation-active');
    };
  }, [isChatMode]);

  useLayoutEffect(() => {
    if (!isChatMode || composerTopBeforeChatRef.current === null) return;
    const composer = composerRef.current;
    const previousTop = composerTopBeforeChatRef.current;
    composerTopBeforeChatRef.current = null;
    if (!composer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const offset = previousTop - composer.getBoundingClientRect().top;
    if (Math.abs(offset) < 1) return;
    const animation = composer.animate(
      [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
      { duration: 680, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
    return () => animation.cancel();
  }, [isChatMode]);

  const showOrb = input.trim().length > 0;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function scrollToDetails() {
    document.getElementById('hero-details')?.scrollIntoView({ behavior: 'smooth' });
  }

  function cancelIntake(): void {
    intakeAbortRef.current?.abort();
  }

  const handleMessageStreamComplete = useCallback((messageId: string): void => {
    if (messageId === finalAssistantIdRef.current) {
      finalAssistantIdRef.current = null;
    }
  }, []);

  async function sendIntakeMessage(rawContent: string, action?: 'finish'): Promise<void> {
    const content = rawContent.trim();
    if (!content || isIntakeLoading) return;

    const userMessage: ConversationMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };
    const assistantId = `assistant-${Date.now()}`;
    composerTopBeforeChatRef.current = composerRef.current?.getBoundingClientRect().top ?? null;

    setConversation((current) => [
      ...current.map((message) => (
        message.role === 'assistant' ? { ...message, suggestions: undefined } : message
      )),
      userMessage,
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setInput('');
    setIsChatMode(true);
    setIsIntakeLoading(true);

    const controller = new AbortController();
    intakeAbortRef.current = controller;

    try {
      const response = await fetch('/api/ai-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Prior turns already live in the signed state; do not duplicate them.
          messages: [{ role: userMessage.role, content }],
          intakeState,
          action,
          thinking,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(typeof failure.error === 'string' ? failure.error : 'AI intake request failed');
      }

      const payload = await response.json() as {
        content?: unknown;
        suggestions?: unknown;
        analysis?: unknown;
        intakeState?: unknown;
      };
      if (typeof payload.content !== 'string' || !payload.content.trim()) {
        throw new Error('AI intake response was empty');
      }
      const assistantContent = payload.content.trim();

      if (payload.intakeState
        && typeof payload.intakeState === 'object'
        && 'version' in payload.intakeState
        && payload.intakeState.version === 2) {
        const nextIntakeState = payload.intakeState as IntakeState;
        setIntakeState(nextIntakeState);
        if (nextIntakeState.complete) finalAssistantIdRef.current = assistantId;
      }

      const suggestions = Array.isArray(payload.suggestions)
        ? payload.suggestions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
        : [];
      const analysis = Array.isArray(payload.analysis)
        ? payload.analysis.filter((item): item is string => typeof item === 'string' && item.trim().replace(/[-–—•*.,;:!?()[\]{}"'`~|/\\\s]/g, '').length > 0).slice(0, 4)
        : [];

      setConversation((current) => current.map((message) => (
        message.id === assistantId
          ? { ...message, content: assistantContent, suggestions, analysis }
          : message
      )));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setConversation((current) => current.filter((message) => message.id !== assistantId));
        return;
      }
      setConversation((current) => current.map((message) => (
        message.id === assistantId
          ? { ...message, content: error instanceof Error && error.message.includes('expired') ? 'სესია განახლდა. განაახლეთ გვერდი და დაიწყეთ ახალი აუდიტი.' : 'პასუხის დამუშავება ვერ მოხერხდა. თქვენი პასუხი ქვემოთ დარჩა — სცადეთ ხელახლა.' }
          : message
      )));
      setInput(content);
    } finally {
      if (intakeAbortRef.current === controller) intakeAbortRef.current = null;
      setIsIntakeLoading(false);
    }
  }

  function handleSubmit(e?: FormEvent) {
    if (e) e.preventDefault();
    const cleanText = input.trim();
    if (!cleanText) return;
    void sendIntakeMessage(cleanText);
  }

  function launchPrompt(promptText: string) {
    void sendIntakeMessage(promptText);
  }

  return (
    <>
      {/* 1. HERO VIEW */}
      <div className={`heroFirstScreen ${isChatMode ? 'heroFirstScreen--conversation' : ''}`}>
        <AnimatePresence initial={false}>
          {!isChatMode ? (
            <motion.div
              className="heroIntroHead"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            >
              <div className="heroWordmarkContainer">
                <div
                  className={`wordmark-3d hero-wordmark hero-product-wordmark ${heroScrolled ? 'scrolled' : ''}`}
                  aria-label="aiAUDIT"
                >
                  <span className="wm-prefix">ai</span>
                  <span className="wm-mark">AUDIT</span>
                  <span className="wm-accent" aria-hidden="true" />
                </div>
              </div>

              <div className="heroPillTag">
                <span className="heroPillDot" />
                <span>AI ბიზნეს აუდიტი &amp; დიაგნოსტიკა</span>
              </div>
              <h1 className="heroIntroTitle">
                გაიგეთ, სად არის AI <br className="hidden sm:inline" />
                <span className="heroIntroHighlight">ნამდვილად სასარგებლო</span> თქვენი ბიზნესისთვის
              </h1>
              <p className="heroIntroLead">
                დაამატეთ საიტი ან მოგვიყევით თქვენი ბიზნესის შესახებ. შევამოწმებთ საჯარო ინფორმაციას, დავაზუსტებთ პროცესებს და შევაფასებთ, სად აქვს AI-ს რეალური ღირებულება.
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {isChatMode ? (
            <motion.div
              className="heroConversationMotionWrap"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08, ease: [0.2, 0, 0, 1] }}
            >
              <HeroIntakeConversation
                messages={conversation}
                isLoading={isIntakeLoading}
                onSuggestion={(suggestion) => void sendIntakeMessage(suggestion)}
                renderOrb={() => <HeroLiquidOrb accent={orbAccent} />}
                onMessageStreamComplete={handleMessageStreamComplete}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Hero Composer Box */}
        <div ref={composerRef} className="heroAiChatWrap">
          {!isChatMode && showOrb ? (
            <div className="heroOrbFloatingPresence animate-in fade-in zoom-in-95 duration-200">
              <div className="heroLiquidOrbMover">
                <HeroLiquidOrb accent={orbAccent} />
              </div>
              <div className="heroOrbPresenceText">
                <span className="heroOrbLiveDot" style={{ background: orbAccent }} />
                <span className="font-semibold text-slate-800 text-xs">aiAUDIT Intelligence</span>
                <span className="text-slate-400 text-xs">·</span>
                <span className="text-slate-500 text-xs">მზად არის ბიზნესის ანალიზისთვის</span>
              </div>
            </div>
          ) : null}

          <div className="heroComposerStack">
            <BorderBeam
              active
              className="heroComposerBeam"
              colorVariant="colorful"
              size="md"
              strength={0.7}
              theme="light"
            >
              <div className="heroComposer">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  maxLength={3000}
                  aria-label="თქვენი პასუხი"
                  placeholder="მაგ: გვაქვს სადისტრიბუციო კომპანია, გვინდა შეკვეთების დამუშავებისა და CRM-ის აუდიტი..."
                  className="heroTextarea"
                />
                <p className="heroInputHint">{isChatMode ? 'უპასუხეთ საკუთარი სიტყვებით. თუ არ იცით, შეგიძლიათ გამოტოვოთ.' : 'დაიწყეთ აღწერით ან დაამატეთ ბმულები ქვემოთ. საიტი აუცილებელი არ არის.'}</p>

                <div className="heroComposerFooter">
                  {/* Left Controls */}
                  <div className="heroComposerLeft">
                    {!isChatMode && <button type="button" className="heroSourceButton" onClick={() => setScannerOpen(true)} aria-label="საიტისა და სოციალური ქსელების დამატება" title="საიტი და სოციალური ქსელები">
                      <Ico name="solar:add-circle-bold-duotone" className="size-5" />
                      <span>საიტი / სოციალური ქსელები</span>
                    </button>}

                    <span className="heroIntelligenceLabel">
                      <Ico name="solar:magic-stick-3-bold-duotone" className="size-3.5 text-indigo-600" />
                      aiAUDIT <span className="heroIntelligenceSuffix">Intelligence</span>
                    </span>
                  </div>

                  {/* Right Controls */}
                  <div className="heroComposerRight">
                    <button 
                      type="button" 
                      className={`heroRoundBtn ${thinking ? 'activeThinking' : ''}`}
                      title={thinking ? "ღრმა აზროვნება ჩართულია" : "ღრმა აზროვნება"}
                      onClick={() => setThinking(!thinking)}
                      aria-label="ღრმა აზროვნება"
                      aria-pressed={thinking}
                      disabled={isIntakeLoading}
                    >
                      <Ico name="solar:lightbulb-bolt-bold-duotone" className={`size-4 ${thinking ? 'text-amber-600' : 'text-slate-600'}`} />
                    </button>

                    <VoiceIntakeButton disabled={isIntakeLoading} language={intakeState?.language || 'ka'} onStatus={setVoiceStatus} onTranscript={(txt) => setInput((prev) => (prev ? prev + ' ' + txt : txt).slice(0, 3000))} />

                    {isIntakeLoading ? (
                      <button
                        type="button"
                        className="heroSendBtn"
                        onClick={cancelIntake}
                        title="შეჩერება"
                        aria-label="პასუხის შეჩერება"
                      >
                        <Ico name="solar:stop-bold-duotone" className="size-4 text-white" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="heroSendBtn"
                        disabled={!input.trim()}
                        onClick={() => handleSubmit()}
                        title="გაგზავნა (Enter)"
                      >
                        <Ico name="solar:arrow-up-bold-duotone" className="size-4 text-white" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="heroVoiceStatus" role="status">{voiceStatus || (thinking ? 'ჩართულია უფრო ღრმა შემოწმება. პასუხს შეიძლება მეტი დრო დასჭირდეს.' : '')}</p>
              </div>
            </BorderBeam>

            {/* Quick Suggestion Chips */}
            {!isChatMode ? (
              <div className="heroQuickChips">
                <button 
                  type="button" 
                  className="heroChip"
                  onClick={() => launchPrompt('გვინდა გაყიდვების, შემომავალი ზარებისა და შეტყობინებების დამუშავების აუდიტი.')}
                >
                  <MessageSquare size={13} className="text-blue-500" />
                  <span>გაყიდვებისა და ზარების აუდიტი</span>
                </button>
                <button 
                  type="button" 
                  className="heroChip"
                  onClick={() => launchPrompt('გვინდა მარკეტინგის, რეკლამისა და კონტენტის ეფექტიანობის შეფასება.')}
                >
                  <Target size={13} className="text-indigo-500" />
                  <span>მარკეტინგისა და რეკლამის აუდიტი</span>
                </button>
                <button 
                  type="button" 
                  className="heroChip"
                  onClick={() => launchPrompt('გვინდა დოკუმენტბრუნვის, CRM-ისა და ოპერაციული რუტინის ავტომატიზაცია.')}
                >
                  <FileText size={13} className="text-purple-500" />
                  <span>დოკუმენტებისა და CRM-ის აუდიტი</span>
                </button>
                <button 
                  type="button" 
                  className="heroChip"
                  onClick={() => launchPrompt('გვინდა გავიგოთ, რომელი AI გადაწყვეტა მოიტანს მაქსიმალურ გაზომვად შედეგს.')}
                >
                  <Zap size={13} className="text-amber-500" />
                  <span>ROI &amp; მიზანშეწონილობის შეფასება</span>
                </button>
              </div>
            ) : null}

          </div>
        </div>

        {/* Scroll Down Hint */}
        {!isChatMode ? (
          <div className="heroScrollIndicator">
            <button 
              type="button" 
              className="heroScrollBtn"
              onClick={scrollToDetails}
            >
              <span>აუდიტის დეტალების დათვალიერება</span>
              <ChevronDown size={14} className="heroScrollChevron" />
            </button>
          </div>
        ) : null}
      </div>
      <ChannelScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onApplyScan={(payload) => {
          setIntakeState(payload.intakeState);
          setConversation([{ id: `scan-${Date.now()}`, role: 'assistant', content: payload.content, suggestions: payload.suggestions }]);
          setIsChatMode(true);
        }}
      />
      {intakeState?.publicScan && <details className="heroSourceSummary">
        <summary>საჯარო წყაროები · {intakeState.publicScan.sources.filter((source) => source.status === 'read').length} წაკითხული გვერდი</summary>
        <p>საჯარო ტექსტი — არა თქვენი პასუხით დადასტურებული ფაქტები.</p>
        {intakeState.publicScan.sources.map((source) => <div key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {source.url}</a>
          <span> · {source.status === 'read' ? 'წაკითხულია' : 'მიუწვდომელია'} · {new Date(source.checkedAt).toLocaleDateString('ka-GE')}</span>
          {source.provider === 'apify' && <details><summary>წყაროს ტექსტი · Apify</summary><p>{source.excerpt}</p><p>ორიგინალთან დამოუკიდებლად არ არის გადამოწმებული. Run: {source.runId}</p></details>}
        </div>)}
        {intakeState.publicScan.observations.map((item, i) => <blockquote key={i}>„{item.quote}“ [{item.sourceId}]</blockquote>)}
      </details>}
      {intakeState && !intakeState.complete && intakeState.turn >= 5 ? (
        <div className="heroQuickChips">
          <button type="button" className="heroChip" disabled={isIntakeLoading} onClick={() => void sendIntakeMessage('მაჩვენეთ დასკვნა არსებული ინფორმაციით.', 'finish')}>
            დასკვნა არსებული ინფორმაციით
          </button>
        </div>
      ) : null}
      {intakeState?.complete ? (
        <div className="heroQuickChips" aria-label="აუდიტის შემდეგი ნაბიჯი">
          <button type="button" className="heroChip" onClick={() => setLeadDialogOpen(true)} disabled={leadSubmitted}>
            {leadSubmitted ? 'მოთხოვნა გაგზავნილია' : 'შედეგების განხილვა'}
          </button>
          <button type="button" className="heroChip" onClick={() => {
            const report = conversation.filter((m) => m.role === 'assistant').at(-1)?.content || '';
            const url = URL.createObjectURL(new Blob([report], { type: 'text/plain;charset=utf-8' }));
            const link = document.createElement('a'); link.href = url; link.download = 'aiAUDIT-report.txt'; link.click(); URL.revokeObjectURL(url);
          }}>ანგარიშის ჩამოტვირთვა</button>
          <button type="button" className="heroChip" onClick={() => {
            const report = conversation.filter((m) => m.role === 'assistant').at(-1)?.content || '';
            const printable = window.open('', '_blank');
            if (!printable) return;
            printable.document.title = 'aiAUDIT — Quick Audit';
            const style = printable.document.createElement('style');
            style.textContent = 'body{font:14px/1.6 Arial,sans-serif;margin:36px;color:#10251c}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}';
            printable.document.head.appendChild(style);
            const text = printable.document.createElement('pre'); text.textContent = report;
            printable.document.body.appendChild(text);
            printable.focus(); printable.print();
          }}>PDF / ბეჭდვა</button>
        </div>
      ) : null}
      <AiIntakeLeadDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        messages={conversation}
        intakeState={intakeState}
        onSubmitted={() => setLeadSubmitted(true)}
      />
    </>
  );
}
