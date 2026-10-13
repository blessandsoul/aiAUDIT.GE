"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { ChatButton } from "@/features/chat-assistant/components/ChatButton";
import { ChatWindow } from "@/features/chat-assistant/components/ChatWindow";
import type { CharacterState, Message } from "@/features/chat-assistant/hooks/useChatAssistant";
import { buildAuditIntakePayload, buildAuditLeadPayload, canSubmitAuditLead, createAuditPopupCallbacks, getAuditScanDisplayLabels, isActiveAuditRequest, isAuditPhoneValid, parseAuditIntakeResponse, requestAuditScan, type AuditIntakeState, type AuditScanDisplayLabels } from "./aiaudit-intake-client";

const COPY = {
  en: { welcome: "Describe one real workflow. The preview does not call a model or create an external report.", error: "The local preview is not authorized to create an audit report. No external request was completed.", scanEmpty: "The adapter returned no usable scan content.", phoneError: "Enter a valid phone number before requesting review.", title: "aiAUDIT", online: "Local preview", placeholder: "Describe your workflow…", clear: "Clear", close: "Close", send: "Send", auditMode: "Audit mode", services: "Describe sources", pricing: "What does it cost?", contact: "What should we prepare?", how: "Show the conclusion", tooltip: "Open aiAUDIT", sleep: "Wake aiAUDIT", scan: "Check public pages", scanPlaceholder: "https://example.ge", lead: "Discuss this result", phone: "Phone", consent: "I agree that this audit context may be sent for review.", submit: "Send review request", leadSuccess: "Review request accepted by the authorized adapter.", labels: { quick: "Quick Audit", deep: "Deep · one process", analysis: "Analysis details", suggestions: "Suggested next steps", check: "Check", loading: "…" } },
  ka: { welcome: "აღწერეთ ერთი რეალური პროცესი. Preview მოდელს არ იძახებს და გარე ანგარიშს არ ქმნის.", error: "ლოკალურ preview-ს აუდიტის ანგარიშის შექმნის უფლება არ აქვს. გარე მოთხოვნა არ შესრულებულა.", scanEmpty: "ადაპტერმა გამოსაყენებელი სკანის შინაარსი არ დააბრუნა.", phoneError: "განხილვის მოთხოვნამდე მიუთითეთ სწორი ტელეფონის ნომერი.", title: "aiAUDIT", online: "ლოკალური შემოწმება", placeholder: "აღწერეთ თქვენი პროცესი…", clear: "გასუფთავება", close: "დახურვა", send: "გაგზავნა", auditMode: "აუდიტის რეჟიმი", services: "აღწერეთ წყაროები", pricing: "რა ღირს?", contact: "რა მოვამზადოთ?", how: "აჩვენეთ დასკვნა", tooltip: "გახსენით aiAUDIT", sleep: "გააღვიძეთ aiAUDIT", scan: "საჯარო გვერდების შემოწმება", scanPlaceholder: "https://example.ge", lead: "განიხილეთ ეს შედეგი", phone: "ტელეფონი", consent: "ვეთანხმები, რომ ეს აუდიტის კონტექსტი განხილვისთვის გაიგზავნოს.", submit: "გაგზავნეთ განხილვის მოთხოვნა", leadSuccess: "განხილვის მოთხოვნა ავტორიზებულმა adapter-მა მიიღო.", labels: { quick: "სწრაფი აუდიტი", deep: "ღრმა · ერთი პროცესი", analysis: "ანალიზის დეტალები", suggestions: "შემდეგი ნაბიჯები", check: "შემოწმება", loading: "…" } },
  ru: { welcome: "Опишите один реальный процесс. Preview не вызывает модель и не создаёт внешний отчёт.", error: "Локальный preview не авторизован создавать отчёт аудита. Внешний запрос не выполнен.", scanEmpty: "Адаптер не вернул пригодное содержимое сканирования.", phoneError: "Укажите корректный номер телефона перед запросом на проверку.", title: "aiAUDIT", online: "Локальная проверка", placeholder: "Опишите процесс…", clear: "Очистить", close: "Закрыть", send: "Отправить", auditMode: "Режим аудита", services: "Описать источники", pricing: "Сколько стоит?", contact: "Что подготовить?", how: "Показать вывод", tooltip: "Открыть aiAUDIT", sleep: "Разбудить aiAUDIT", scan: "Проверить публичные страницы", scanPlaceholder: "https://example.ge", lead: "Обсудить этот результат", phone: "Телефон", consent: "Я согласен отправить контекст аудита на проверку.", submit: "Отправить запрос на проверку", leadSuccess: "Запрос на проверку принят авторизованным адаптером.", labels: { quick: "Быстрый аудит", deep: "Глубокий · один процесс", analysis: "Детали анализа", suggestions: "Следующие шаги", check: "Проверить", loading: "…" } },
} as const;

export function AiAuditChatBridge() {
  const locale = useLocale();
  const copy = COPY[locale === "ka" || locale === "ru" ? locale : "en"];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", content: copy.welcome }]);
  const [isLoading, setIsLoading] = useState(false);
  const [characterState, setCharacterState] = useState<CharacterState>("idle");
  const [mode, setMode] = useState<"quick" | "deep">("quick");
  const [intakeState, setIntakeState] = useState<AuditIntakeState | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<unknown>(null);
  const [scanValue, setScanValue] = useState("");
  const [scanPending, setScanPending] = useState(false);
  const [scanError, setScanError] = useState<string | undefined>();
  const [scanDetails, setScanDetails] = useState<{ sources: { id?: string; url: string; status?: string; checkedAt?: string; excerpt?: string; recordType?: string }[]; observations?: { sourceId?: string; quote: string }[]; aiStatus?: string; labels: AuditScanDisplayLabels } | undefined>();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [leadPending, setLeadPending] = useState(false);
  const [leadError, setLeadError] = useState<string | undefined>();
  const [leadSuccess, setLeadSuccess] = useState<string | undefined>();
  const controllerRef = useRef<AbortController | null>(null);
  const scanControllerRef = useRef<AbortController | null>(null);
  const leadControllerRef = useRef<AbortController | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const removePendingMessage = () => {
    const pendingId = pendingMessageRef.current;
    if (!pendingId) return;
    pendingMessageRef.current = null;
    if (mountedRef.current) setMessages((current) => current.filter((item) => item.id !== pendingId));
  };

  const abortAll = () => {
    controllerRef.current?.abort();
    scanControllerRef.current?.abort();
    leadControllerRef.current?.abort();
    controllerRef.current = null;
    scanControllerRef.current = null;
    leadControllerRef.current = null;
    removePendingMessage();
  };

  useEffect(() => {
    mountedRef.current = true;
    const open = (event: Event) => { event.preventDefault(); setIsOpen(true); };
    window.addEventListener("aiaudit-open-chat", open);
    return () => { mountedRef.current = false; window.removeEventListener("aiaudit-open-chat", open); controllerRef.current?.abort(); scanControllerRef.current?.abort(); leadControllerRef.current?.abort(); controllerRef.current = null; scanControllerRef.current = null; leadControllerRef.current = null; pendingMessageRef.current = null; };
  }, []);

  const sendMessage = async (message: string) => {
    const newest = message.trim();
    if (!newest || isLoading) return;
    abortAll();
    setScanPending(false);
    setLeadPending(false);
    setScanError(undefined);
    const controller = new AbortController();
    controllerRef.current = controller;
    const userMessage: Message = { id: `user-${Date.now()}`, role: "user", content: newest };
    const pendingId = `assistant-${Date.now()}`;
    pendingMessageRef.current = pendingId;
    setAssessment(null);
    setLeadSuccess(undefined);
    setLeadError(undefined);
    setPhone("");
    setConsent(false);
    setScanDetails(undefined);
    setSuggestions([]);
    setAnalysis([]);
    setMessages((current) => [...current.filter((item) => !(item.role === "assistant" && !item.content)), userMessage, { id: pendingId, role: "assistant", content: "" }]);
    setIsLoading(true);
    setCharacterState("thinking");
    try {
      const finish = /show the conclusion|აჩვენეთ დასკვნა|показать вывод/i.test(newest);
      const response = await fetch("/api/ai-intake", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(buildAuditIntakePayload({ newestMessage: newest, intakeState, mode, thinking: false, ...(finish ? { action: "finish" as const } : {}) })), signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(copy.error);
      const parsed = parseAuditIntakeResponse(payload, { requireState: true });
      if (!parsed) throw new Error(copy.error);
      if (!isActiveAuditRequest(mountedRef.current, controllerRef.current, controller)) return;
      setIntakeState(parsed.intakeState ?? null);
      setSuggestions(parsed.suggestions);
      setAnalysis(parsed.analysis);
      setAssessment(parsed.assessment);
      setScanDetails(undefined);
      setMessages((current) => current.map((item) => item.id === pendingId ? { ...item, content: parsed.content } : item));
      setCharacterState("talking");
    } catch (error) {
      if ((error as Error).name === "AbortError" || !isActiveAuditRequest(mountedRef.current, controllerRef.current, controller)) return;
      setMessages((current) => current.map((item) => item.id === pendingId ? { ...item, content: (error as Error).message || copy.error } : item));
      setSuggestions([]);
      setAnalysis([]);
      setCharacterState("idle");
    } finally {
      if (isActiveAuditRequest(mountedRef.current, controllerRef.current, controller)) { pendingMessageRef.current = null; setIsLoading(false); window.setTimeout(() => isActiveAuditRequest(mountedRef.current, controllerRef.current, controller) && setCharacterState("idle"), 700); }
    }
  };

  const checkSources = async () => {
    const urls = scanValue.split(/\s+/u).map((url) => url.trim()).filter(Boolean);
    if (!urls.length || scanPending) return;
    if (isLoading) { abortAll(); setIsLoading(false); setCharacterState("idle"); }
    leadControllerRef.current?.abort();
    leadControllerRef.current = null;
    setLeadPending(false);
    setLeadSuccess(undefined);
    setLeadError(undefined);
    setAssessment(null);
    setIntakeState(null);
    setPhone("");
    setConsent(false);
    scanControllerRef.current?.abort();
    const controller = new AbortController();
    scanControllerRef.current = controller;
    setScanPending(true);
    setScanError(undefined);
    try {
      const response = await requestAuditScan(fetch, urls, mode, controller.signal);
      if (!response.ok) throw new Error(copy.error);
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      const scan = body?.scan && typeof body.scan === "object" ? body.scan as Record<string, unknown> : null;
      const sources = Array.isArray(scan?.sources) ? scan.sources.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).url === "string")).map((item) => ({ id: typeof item.id === "string" ? item.id : undefined, url: item.url as string, status: typeof item.status === "string" ? item.status : undefined, checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : undefined, excerpt: typeof item.excerpt === "string" ? item.excerpt : undefined, recordType: typeof item.recordType === "string" ? item.recordType : undefined })) : [];
      const observations = Array.isArray(scan?.observations) ? scan.observations.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).quote === "string")).map((item) => ({ sourceId: typeof item.sourceId === "string" ? item.sourceId : undefined, quote: item.quote as string })) : [];
      const parsed = parseAuditIntakeResponse({ content: body?.content, suggestions: body?.suggestions, analysis: body?.analysis, intakeState: body?.intakeState, progress: body?.progress, assessment: body?.assessment });
      if (!parsed && sources.length === 0) throw new Error(copy.scanEmpty);
      if (isActiveAuditRequest(mountedRef.current, scanControllerRef.current, controller)) {
        if (parsed) {
          setIntakeState(parsed.intakeState ?? intakeState);
          setSuggestions(parsed.suggestions);
          setAnalysis(parsed.analysis);
          setAssessment(parsed.assessment);
        }
        setScanDetails({ sources, observations, aiStatus: typeof scan?.aiStatus === "string" ? scan.aiStatus : undefined, labels: getAuditScanDisplayLabels(locale, sources.length) });
        if (parsed) setMessages((current) => [...current, { id: `scan-${Date.now()}`, role: "assistant", content: parsed.content }]);
      }
    } catch (error) { if ((error as Error).name !== "AbortError" && isActiveAuditRequest(mountedRef.current, scanControllerRef.current, controller)) setScanError((error as Error).message || copy.error); }
    finally { if (isActiveAuditRequest(mountedRef.current, scanControllerRef.current, controller)) setScanPending(false); }
  };

  const submitLead = async () => {
    if (!canSubmitAuditLead({ intakeState, assessment, phone, consent, pending: leadPending })) { if (!isAuditPhoneValid(phone) && mountedRef.current) setLeadError(copy.phoneError); return; }
    scanControllerRef.current?.abort();
    scanControllerRef.current = null;
    setScanPending(false);
    setScanError(undefined);
    setScanDetails(undefined);
    leadControllerRef.current?.abort();
    const controller = new AbortController();
    leadControllerRef.current = controller;
    setLeadPending(true);
    setLeadError(undefined);
    setLeadSuccess(undefined);
    try {
      const payload = buildAuditLeadPayload({ phone: phone.trim(), website: "", messages: messages.map(({ role, content }) => ({ role, content })), intakeState: intakeState! });
      const response = await fetch("/api/ai-intake/lead", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      const body = await response.json().catch(() => null) as { ok?: boolean; leadId?: string } | null;
      if (!response.ok || !body?.ok || !body.leadId) throw new Error(copy.error);
      if (isActiveAuditRequest(mountedRef.current, leadControllerRef.current, controller)) setLeadSuccess(copy.leadSuccess);
    } catch (error) { if ((error as Error).name !== "AbortError" && isActiveAuditRequest(mountedRef.current, leadControllerRef.current, controller)) setLeadError((error as Error).message || copy.error); }
    finally { if (isActiveAuditRequest(mountedRef.current, leadControllerRef.current, controller)) setLeadPending(false); }
  };

  const resetSignedState = () => { setIntakeState(null); setSuggestions([]); setAnalysis([]); setAssessment(null); setScanDetails(undefined); setScanValue(""); setScanError(undefined); setPhone(""); setConsent(false); setLeadError(undefined); setLeadSuccess(undefined); setIsLoading(false); setScanPending(false); setLeadPending(false); };
  const clearChat = () => { abortAll(); resetSignedState(); setMode("quick"); setMessages([{ id: "welcome", role: "assistant", content: copy.welcome }]); };
  const changeMode = (nextMode: "quick" | "deep") => { abortAll(); resetSignedState(); setMode(nextMode); setMessages([{ id: "welcome", role: "assistant", content: copy.welcome }]); };
  const popupCallbacks = createAuditPopupCallbacks({ checkSources, submitLead });
  const closeChat = () => { abortAll(); setIsOpen(false); setIsLoading(false); setScanPending(false); setLeadPending(false); setCharacterState("idle"); };

  return <div className="fixed inset-x-2 bottom-6 z-50 flex justify-end sm:inset-x-auto sm:right-6"><div className="relative">{isOpen ? <ChatWindow messages={messages} isLoading={isLoading} characterState={characterState} onSendMessage={sendMessage} onClose={closeChat} onClear={clearChat} onSuggestion={sendMessage} suggestions={suggestions} analysis={analysis} mode={mode} onModeChange={changeMode} scanDetails={scanDetails} className="w-[380px] max-w-[calc(100vw-1rem)]" scan={{ label: copy.scan, placeholder: copy.scanPlaceholder, value: scanValue, pending: scanPending, error: scanError, onChange: setScanValue, onSubmit: popupCallbacks.scanSubmit }} lead={assessment ? { label: copy.lead, phoneLabel: copy.phone, consentLabel: copy.consent, submitLabel: copy.submit, value: phone, consent, pending: leadPending, error: leadError, success: leadSuccess, onChange: setPhone, onConsentChange: setConsent, onSubmit: popupCallbacks.leadSubmit } : undefined} t={{ title: copy.title, online: copy.online, placeholder: copy.placeholder, clear: copy.clear, close: copy.close, quickServices: copy.services, quickPricing: copy.pricing, quickContact: copy.contact, quickHow: copy.how, send: copy.send, auditMode: copy.auditMode, labels: copy.labels }} /> : null}<ChatButton onClick={() => isOpen ? closeChat() : setIsOpen(true)} characterState={isOpen ? "happy" : characterState} onWakeUp={() => setCharacterState("idle")} tooltip={isOpen ? copy.close : copy.tooltip} sleepTooltip={copy.sleep} ariaLabel={isOpen ? copy.close : copy.tooltip} /></div></div>;
}
