'use client';

import { ReactNode, useEffect, useRef, useState, type WheelEvent } from 'react';
import { parseAuditReport, type AuditReportSection } from './audit-report-parser';

export type ConversationMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  suggestions?: string[];
  analysis?: string[];
};

interface HeroIntakeConversationProps {
  messages: ConversationMessage[];
  isLoading: boolean;
  onSuggestion: (suggestion: string) => void;
  renderOrb: () => ReactNode;
  onMessageStreamComplete: (messageId: string) => void;
  language?: IntakeChatLanguage;
}

function scrollMessageIntoStage(
  stage: HTMLElement,
  message: HTMLElement,
  behavior: ScrollBehavior,
) {
  const top = message.getBoundingClientRect().top - stage.getBoundingClientRect().top + stage.scrollTop - 12;
  stage.scrollTo({ top: Math.max(0, top), behavior });
}

function StreamingAssistantText({
  content,
  messageId,
  onComplete,
  stageRef,
}: {
  content: string;
  messageId: string;
  onComplete: (messageId: string) => void;
  stageRef: React.RefObject<HTMLElement | null>;
}) {
  const [visibleContent, setVisibleContent] = useState('');

  useEffect(() => {
    let index = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer = window.setTimeout(() => {
      if (reducedMotion || content.startsWith('aiAUDIT · Quick Audit')) {
        setVisibleContent(content);
        onComplete(messageId);
        return;
      }

      setVisibleContent('');
      const revealNext = () => {
        index = Math.min(content.length, index + (index < 90 ? 4 : 3));
        setVisibleContent(content.slice(0, index));
        if (index < content.length) {
          timer = window.setTimeout(revealNext, 9);
        } else {
          onComplete(messageId);
        }
      };

      revealNext();
    }, reducedMotion ? 0 : 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [content, messageId, onComplete]);

  useEffect(() => {
    if (!visibleContent || content.startsWith('aiAUDIT · Quick Audit')) return;
    const stage = stageRef.current;
    if (stage) stage.scrollTop = stage.scrollHeight;
  }, [stageRef, visibleContent, content]);

  const isTyping = visibleContent.length < content.length;
  return (
    <p className="heroConversationAssistantText" aria-live="off">
      {visibleContent}
      {isTyping ? <span className="heroConversationCaret" aria-hidden="true">|</span> : null}
    </p>
  );
}

export type IntakeChatLanguage = 'ka' | 'ru' | 'en';

export const INTAKE_CHAT_COPY: Record<IntakeChatLanguage, {
  reportSubtitle: string;
  reportDetails: string;
  reportEmpty: string;
  reportAria: string;
  exit: string;
  resume: string;
  finish: string;
  finishPrompt: string;
  actionsLabel: string;
  lead: string;
  sent: string;
  download: string;
  print: string;
  chatAria: string;
}> = {
  ka: {
    reportSubtitle: 'მოკლე შედეგი და შემდეგი პრაქტიკული ნაბიჯი',
    reportDetails: 'სრული ანგარიში და მტკიცებულებები',
    reportEmpty: 'დეტალები ჯერ არ არის ხელმისაწვდომი.',
    reportAria: 'aiAUDIT აუდიტის ანგარიში',
    exit: 'ჩატიდან დაბრუნება',
    resume: 'ჩატის გაგრძელება',
    finish: 'დასკვნა არსებული ინფორმაციით',
    finishPrompt: 'მაჩვენეთ დასკვნა არსებული ინფორმაციით.',
    actionsLabel: 'აუდიტის შემდეგი ნაბიჯი',
    lead: 'შედეგების განხილვა',
    sent: 'მოთხოვნა გაგზავნილია',
    download: 'ანგარიშის ჩამოტვირთვა',
    print: 'PDF / ბეჭდვა',
    chatAria: 'aiAUDIT Intelligence ჩატი',
  },
  ru: {
    reportSubtitle: 'Краткий результат и следующий практический шаг',
    reportDetails: 'Полный отчёт и основания',
    reportEmpty: 'Подробности пока недоступны.',
    reportAria: 'Отчёт аудита aiAUDIT',
    exit: 'Вернуться из чата',
    resume: 'Продолжить чат',
    finish: 'Показать вывод по имеющимся данным',
    finishPrompt: 'Покажите вывод по имеющимся данным.',
    actionsLabel: 'Следующие шаги аудита',
    lead: 'Обсудить результаты',
    sent: 'Запрос отправлен',
    download: 'Скачать отчёт',
    print: 'PDF / Печать',
    chatAria: 'Чат aiAUDIT Intelligence',
  },
  en: {
    reportSubtitle: 'A concise result and the next practical step',
    reportDetails: 'Full report and evidence',
    reportEmpty: 'Details are not available yet.',
    reportAria: 'aiAUDIT audit report',
    exit: 'Return from chat',
    resume: 'Continue chat',
    finish: 'Show conclusion from current information',
    finishPrompt: 'Show the conclusion from the current information.',
    actionsLabel: 'Next audit steps',
    lead: 'Discuss results',
    sent: 'Request sent',
    download: 'Download report',
    print: 'PDF / Print',
    chatAria: 'aiAUDIT Intelligence chat',
  },
};

function ReportBody({ body }: { body: string }) {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const groups: Array<{ type: 'paragraph' | 'list'; lines: string[] }> = [];
  for (const line of lines) {
    const isBullet = /^[•*-]\s+/.test(line);
    const type = isBullet ? 'list' : 'paragraph';
    const last = groups.at(-1);
    if (last?.type === type) last.lines.push(line.replace(/^[•*-]\s+/, ''));
    else groups.push({ type, lines: [line.replace(/^[•*-]\s+/, '')] });
  }
  return (
    <div className="heroAuditReportBody">
      {groups.map((group, index) => group.type === 'list' ? (
        <ul key={`list-${index}`}>
          {group.lines.map((line, itemIndex) => <li key={`${line}-${itemIndex}`}>{line}</li>)}
        </ul>
      ) : <p key={`paragraph-${index}`}>{group.lines.join(' ')}</p>)}
    </div>
  );
}

function AuditReportView({ content, language = 'ka' }: { content: string; language?: IntakeChatLanguage }) {
  const parsed = parseAuditReport(content);
  const copy = INTAKE_CHAT_COPY[language];
  const byKey = new Map(parsed.sections.map((section) => [section.key, section]));
  const conclusion = byKey.get('conclusion');
  const next = byKey.get('next');
  const measure = byKey.get('measure');
  const summarySections = [conclusion, next, measure].filter((section): section is AuditReportSection => Boolean(section));

  return (
    <div className="heroAuditReport" aria-label={copy.reportAria}>
      <div className="heroAuditReportHeader">
        <span className="heroAuditReportEyebrow">aiAUDIT Intelligence</span>
        <h2>{parsed.title.replace(/^aiAUDIT\s*·\s*/i, '')}</h2>
        <p>{copy.reportSubtitle}</p>
      </div>

      {summarySections.length ? (
        <div className="heroAuditReportSummary">
          {summarySections.map((section) => (
            <section key={section.key} className={`heroAuditSummaryCard heroAuditSummaryCard--${section.key}`}>
              <span>{section.heading}</span>
              <ReportBody body={section.body.split(/\n{2,}/)[0] || section.body} />
            </section>
          ))}
        </div>
      ) : null}

      <details className="heroAuditReportDetails">
        <summary>{copy.reportDetails}</summary>
        <div className="heroAuditReportSections">
          {parsed.fallback.map((block, index) => <ReportBody key={`fallback-${index}`} body={block} />)}
          {parsed.sections.map((section) => (
            <details key={`${section.key}-${section.heading}`} className="heroAuditReportSection">
              <summary>{section.heading}</summary>
              <ReportBody body={section.body || copy.reportEmpty} />
            </details>
          ))}
          {!parsed.sections.length && !parsed.fallback.length ? <ReportBody body={content} /> : null}
        </div>
      </details>
    </div>
  );
}

export function HeroIntakeConversation({
  messages,
  isLoading,
  onSuggestion,
  renderOrb,
  onMessageStreamComplete,
  language = 'ka',
}: HeroIntakeConversationProps) {
  const stageRef = useRef<HTMLElement>(null);
  const previousFocusStateRef = useRef<{
    userId?: string;
    assistantId?: string;
    assistantHasContent: boolean;
  }>({ assistantHasContent: false });

  useEffect(() => {
    const latestUser = [...messages].reverse().find((message) => message.role === 'user');
    const latestAssistant = messages.at(-1)?.role === 'assistant' ? messages.at(-1) : undefined;
    const previous = previousFocusStateRef.current;
    const shouldFocusUser = Boolean(
      latestUser
      && latestUser.id !== previous.userId
      && !latestAssistant?.content,
    );
    const shouldFocusAssistant = Boolean(
      latestAssistant?.content
      && latestAssistant.id === previous.assistantId
      && !previous.assistantHasContent,
    );

    previousFocusStateRef.current = {
      userId: latestUser?.id,
      assistantId: latestAssistant?.id,
      assistantHasContent: Boolean(latestAssistant?.content),
    };

    const targetId = shouldFocusUser ? latestUser?.id : shouldFocusAssistant ? latestAssistant?.id : undefined;
    if (!targetId) return;

    const frame = window.requestAnimationFrame(() => {
      const stage = stageRef.current;
      const message = stage?.querySelector<HTMLElement>(`[data-conversation-id="${targetId}"]`);
      if (!stage || !message) return;
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      scrollMessageIntoStage(stage, message, behavior);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  function handleStageWheel(event: WheelEvent<HTMLElement>) {
    const stage = event.currentTarget;
    if (stage.scrollHeight <= stage.clientHeight) return;

    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const isMovingUp = delta < 0;
    const isMovingDown = delta > 0;
    const isAtTop = stage.scrollTop <= 0;
    const isAtBottom = stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 1;

    if ((isMovingUp && isAtTop) || (isMovingDown && isAtBottom)) return;

    event.preventDefault();
    stage.scrollTop += delta;
  }

  return (
    <section
      ref={stageRef}
      className="heroConversationStage"
      aria-label="aiAUDIT Intelligence დიალოგი"
      aria-live="polite"
      onWheel={handleStageWheel}
    >
      <div className="heroConversationStream">
        {messages.map((message) => (
          message.role === 'user' ? (
            <div key={message.id} className="heroConversationUserTurn" data-conversation-id={message.id}>
              <p className="heroConversationUserMessage">{message.content}</p>
            </div>
          ) : (
            <article key={message.id} className="heroConversationAssistantMessage" data-conversation-id={message.id}>
              <div className="heroConversationAssistantIdentity">
                <span className="heroConversationOrb" aria-hidden="true">{renderOrb()}</span>
                <span>aiAUDIT Intelligence</span>
              </div>

              {message.content ? (
                /^aiAUDIT\s*·\s*(?:Quick|Deep)/i.test(message.content)
                  ? <AuditReportView content={message.content} language={language} />
                  : <StreamingAssistantText
                      content={message.content}
                      messageId={message.id}
                      onComplete={onMessageStreamComplete}
                      stageRef={stageRef}
                    />
              ) : (
                <div className="heroConversationThinking" aria-label="aiAUDIT Intelligence აანალიზებს">
                  <span />
                  <span />
                  <span />
                </div>
              )}

              {message.suggestions?.length ? (
                <div className="heroConversationSuggestions" aria-label="შესაძლო პასუხები">
                  {message.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="heroConversationSuggestion"
                      disabled={isLoading}
                      onClick={() => onSuggestion(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          )
        ))}
      </div>
    </section>
  );
}
