'use client';

import { ChevronDown } from 'lucide-react';
import { ReactNode, useEffect, useRef, useState, type WheelEvent } from 'react';

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
      if (reducedMotion) {
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
    if (!visibleContent) return;
    const stage = stageRef.current;
    if (stage) stage.scrollTop = stage.scrollHeight;
  }, [stageRef, visibleContent]);

  const isTyping = visibleContent.length < content.length;
  return (
    <p className="heroConversationAssistantText" aria-live="off">
      {visibleContent}
      {isTyping ? <span className="heroConversationCaret" aria-hidden="true">|</span> : null}
    </p>
  );
}

export function HeroIntakeConversation({
  messages,
  isLoading,
  onSuggestion,
  renderOrb,
  onMessageStreamComplete,
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
                <StreamingAssistantText
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

              {message.analysis?.length ? (
                <details className="heroConversationTrace">
                  <summary>
                    <span>რა გაითვალისწინა AI-მ</span>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </summary>
                  <ul>
                    {message.analysis.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </details>
              ) : null}

              {message.suggestions?.length === 3 ? (
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
