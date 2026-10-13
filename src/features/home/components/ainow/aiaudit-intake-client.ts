export type AuditMessage = { role: "user" | "assistant"; content: string };
export const AUDIT_SCAN_DEADLINE_MS = 180_000;

export function isAuditPhoneValid(value: string): boolean {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.length >= 6 && trimmed.length <= 20 && /^\+?[\d\s()-]+$/.test(trimmed) && digits.length >= 9 && digits.length <= 15;
}

export function isActiveAuditRequest(mounted: boolean, current: AbortController | null, request: AbortController): boolean {
  return mounted && current === request && !request.signal.aborted;
}

export function canSubmitAuditLead(input: { intakeState: AuditIntakeState | null; assessment: unknown; phone: string; consent: boolean; pending: boolean }): boolean {
  return Boolean(input.intakeState?.complete === true && input.assessment && isAuditPhoneValid(input.phone) && input.consent && !input.pending);
}

export type AuditScanDisplayLabels = {
  summary: string;
  status: Record<string, string>;
  recordType: Record<string, string>;
  boundary: string;
};

export function getAuditScanDisplayLabels(locale: string, count: number): AuditScanDisplayLabels {
  if (locale === "ka") return { summary: `${count} წყარო შემოწმდა`, status: { read: "წაკითხულია", restricted: "წვდომა შეზღუდულია", unavailable: "მიუწვდომელია" }, recordType: { post: "პუბლიკაცია", comment: "კომენტარი" }, boundary: "ეს არის საჯარო გვერდების ტექსტი და არა დადასტურებული ბიზნესდიაგნოზი." };
  if (locale === "ru") return { summary: `Проверено источников: ${count}`, status: { read: "прочитано", restricted: "доступ ограничен", unavailable: "недоступен" }, recordType: { post: "публикация", comment: "комментарий" }, boundary: "Это текст публичных страниц, а не подтверждённая диагностика бизнеса." };
  return { summary: `${count} source${count === 1 ? "" : "s"} checked`, status: { read: "read", restricted: "access restricted", unavailable: "unavailable" }, recordType: { post: "post", comment: "comment" }, boundary: "This is public-page text, not a confirmed business diagnosis." };
}

export type AuditIntakeState = {
  version: 2;
  [key: string]: unknown;
};

export type AuditIntakeResponse = {
  content: string;
  suggestions: string[];
  analysis: string[];
  intakeState?: AuditIntakeState;
  progress: unknown;
  assessment: unknown;
};

export function createAuditPopupCallbacks(actions: { checkSources: () => Promise<void>; submitLead: () => Promise<void> }) {
  return {
    scanSubmit: () => void actions.checkSources(),
    leadSubmit: () => void actions.submitLead(),
  };
}

export function dispatchAuditOpenRequest(dispatcher: (event: Event) => boolean): boolean {
  const event = new Event("aiaudit-open-chat", { cancelable: true });
  return dispatcher(event) === false;
}

export function buildAuditIntakePayload(input: {
  newestMessage: string;
  intakeState: AuditIntakeState | null;
  mode: "quick" | "deep";
  thinking: boolean;
  action?: "finish";
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    messages: [{ role: "user", content: input.newestMessage }],
    intakeState: input.intakeState,
    mode: input.mode,
    thinking: input.thinking,
  };
  if (input.action) payload.action = input.action;
  return payload;
}

export function parseAuditIntakeResponse(value: unknown, options: { requireState?: boolean } = {}): AuditIntakeResponse | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.content !== "string" || !candidate.content.trim()) return null;
  if (options.requireState && (candidate.intakeState === undefined || candidate.intakeState === null)) return null;
  if (candidate.intakeState !== undefined && candidate.intakeState !== null && (typeof candidate.intakeState !== "object" || (candidate.intakeState as Record<string, unknown>).version !== 2)) return null;
  return {
    content: candidate.content,
    suggestions: Array.isArray(candidate.suggestions) ? candidate.suggestions.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 6) : [],
    analysis: Array.isArray(candidate.analysis) ? candidate.analysis.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 4) : [],
    intakeState: candidate.intakeState as AuditIntakeState | undefined,
    progress: candidate.progress,
    assessment: candidate.assessment,
  };
}

export function buildAuditScanPollUrl(job: string): string {
  return `/api/ai-intake/scan?job=${encodeURIComponent(job)}`;
}

export function buildAuditLeadPayload(input: {
  phone: string;
  website?: string;
  messages: readonly AuditMessage[];
  intakeState: AuditIntakeState;
}): Record<string, unknown> {
  return {
    phone: input.phone,
    consent: true,
    website: input.website ?? "",
    messages: input.messages,
    intakeState: input.intakeState,
  };
}

export async function pollAuditScan(
  fetcher: typeof fetch,
  job: string,
  options: { signal?: AbortSignal; deadlineMs?: number; intervalMs?: number } = {},
): Promise<Response> {
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
  const deadline = Date.now() + (options.deadlineMs ?? AUDIT_SCAN_DEADLINE_MS);
  const interval = options.intervalMs ?? 500;
  let response = await fetcher(buildAuditScanPollUrl(job), { signal: options.signal, cache: "no-store" });
  while (response.status === 202 && Date.now() < deadline) {
    await new Promise<void>((resolve, reject) => {
      if (options.signal?.aborted) { reject(options.signal.reason ?? new DOMException("Aborted", "AbortError")); return; }
      const timer = setTimeout(() => { cleanup(); resolve(); }, interval);
      const onAbort = () => { clearTimeout(timer); cleanup(); reject(options.signal?.reason ?? new DOMException("Aborted", "AbortError")); };
      const cleanup = () => options.signal?.removeEventListener("abort", onAbort);
      options.signal?.addEventListener("abort", onAbort, { once: true });
    });
    response = await fetcher(buildAuditScanPollUrl(job), { signal: options.signal, cache: "no-store" });
  }
  if (response.status === 202) throw new Error("Audit scan polling deadline exceeded");
  return response;
}

export async function requestAuditScan(
  fetcher: typeof fetch,
  urls: readonly string[],
  mode: "quick" | "deep",
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetcher("/api/ai-intake/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ urls, mode }),
    signal,
  });
  if (response.status !== 202) return response;
  const body = await response.json() as { job?: string };
  if (!body.job) throw new Error("Scan adapter returned no job id");
  return pollAuditScan(fetcher, body.job, { signal });
}
