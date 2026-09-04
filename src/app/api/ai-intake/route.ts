import { NextRequest, NextResponse } from 'next/server';

import {
  INTAKE_FACT_DEFINITIONS,
  INTAKE_FACT_IDS,
  advanceIntakeState,
  buildFallbackQuestion,
  buildFinalBrief,
  fallbackSuggestions,
  hasEmptyAcknowledgementPrefix,
  intakeProgress,
  parseIntakeState,
  publicFactSummary,
  type IntakeFactId,
  type IntakeLanguage,
} from '@/lib/ai-intake-controller';

type IntakeMessage = { role: 'assistant' | 'user'; content: string };

interface ParsedProviderResponse {
  reply: string;
  suggestedAnswers: string[];
  factUpdates: unknown;
  questionTargets: unknown;
}

const MAX_MESSAGES = 32;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_REQUESTS = 30;
const WINDOW_MS = 60 * 60 * 1_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const INTAKE_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    suggestedAnswers: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
    factUpdates: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          field: { type: 'string', enum: INTAKE_FACT_IDS },
          status: { type: 'string', enum: ['partial', 'answered', 'declined', 'not_applicable'] },
          summary: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['field', 'status', 'summary', 'evidence'],
      },
    },
    questionTargets: { type: 'array', items: { type: 'string', enum: INTAKE_FACT_IDS }, maxItems: 1 },
  },
  required: ['reply', 'suggestedAnswers', 'factUpdates', 'questionTargets'],
} as const;

const SYSTEM_PROMPT = `You are aiAUDIT Intelligence, a business diagnostics and AI audit specialist for aiAUDIT (aiAUDIT.ge).

Your only objective is to understand what this specific client actually needs. This is an adaptive conversation, never a fixed questionnaire or a product funnel.

Rules:
- Use the latest user answer and the supplied fact ledger. Extract every supported fact from the latest answer, even when it answers a question that was not asked.
- Before choosing the next question, scan all ten field definitions against the latest answer. Do not omit an obvious supported update. Apply each field's sufficientWhen rule literally instead of being overly conservative.
- Never make Excel, spreadsheets, CRM, catalogues, data sources, social media, integrations, or any aiNOW product the centre of the conversation unless the user's own task makes it relevant.
- Do not follow a predetermined industry script. Select the next question only from genuinely unresolved fields in the ledger.
- Do not ask for a fact whose ledger status is answered, declined, not_applicable, or needs_follow_up.
- Ask exactly one diagnostic question per turn. Prefer the question that distinguishes the strongest competing explanations of the client's situation, not the next item in a generic form.
- When a client already gave several facts, make a concise evidence-bound inference and ask the one question that would confirm or reject it. For example, a low number of inbound messages from an online shop is an acquisition/funnel hypothesis, not evidence that message automation is needed.
- Use partial when the latest answer gives a useful fact but the field still needs one focused clarification. Use answered only when that field is sufficient for a practical brief.
- If a field is irrelevant to this specific task, mark it not_applicable. Do not force the client to invent an answer.
- If the client does not know or declines to answer, mark it declined. An approximate volume or outcome is acceptable.
- Do not begin with “გასაგებია”, “Понятно”, “Я понял”, “I understand”, or a paraphrase of the user's last sentence. Start with a new useful inference.
- Do not make causal commercial claims, such as promising higher sales or average order value, unless the client supplied evidence for that claim.
- The reply must be concise, natural, practical, and in the user's language. Do not sell, name a price, promise feasibility, timing, KPI, or automation level without human verification.
- While the brief is still incomplete, do not prescribe a product or claim what a future solution will achieve. Explain only which decision the next missing facts will clarify.
- suggestedAnswers must contain exactly three plausible client-side answers. Each option must answer the entire question bundle, not only its first part. The user remains free to type something else.
- factUpdates may only contain facts supported by the latest user message. Each array item uses status partial/answered/declined/not_applicable, a concise factual summary, and evidence copied verbatim from the latest user message. Unsupported or non-verbatim evidence is rejected by the controller.
- questionTargets contains zero or one allowed field id that remains unresolved after applying factUpdates.
- Return exactly the five top-level keys shown below. Do not rename or omit them. factUpdates must be an array.
{"reply":"natural response with the next question","suggestedAnswers":["complete option 1","complete option 2","complete option 3"],"factUpdates":[{"field":"objective","status":"answered","summary":"concise supported fact","evidence":"exact quote from latest user message"}],"questionTargets":["current_process"]}`;

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

function isIntakeMessage(value: unknown): value is IntakeMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { role?: unknown; content?: unknown };
  return (candidate.role === 'assistant' || candidate.role === 'user')
    && typeof candidate.content === 'string'
    && candidate.content.trim().length > 0
    && candidate.content.length <= MAX_MESSAGE_LENGTH;
}

function getLanguage(messages: IntakeMessage[]): IntakeLanguage {
  const message = [...messages].reverse().find((item) => item.role === 'user')?.content ?? '';
  if (/[Ѐ-ӿ]/.test(message)) return 'ru';
  if (/[Ⴀ-ჿ]/.test(message)) return 'ka';
  return 'en';
}

function normaliseTextList(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [];
  return [...new Set(entries
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean))].slice(0, 3);
}

function normaliseFactUpdates(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([field, raw]) => {
    if (!raw || typeof raw !== 'object') return [];
    const fact = raw as Record<string, unknown>;
    const rawStatus = typeof fact.status === 'string' ? fact.status : 'answered';
    const status = rawStatus === 'partially_filled' || rawStatus === 'incomplete'
      ? 'partial'
      : rawStatus === 'complete' || rawStatus === 'filled' || rawStatus === 'known'
        ? 'answered'
        : rawStatus === 'irrelevant' || rawStatus === 'not_relevant'
          ? 'not_applicable'
          : rawStatus;
    return [{ field, status, summary: fact.summary, evidence: fact.evidence }];
  });
}

function parseProviderResponse(rawContent: string): ParsedProviderResponse {
  const trimmed = rawContent.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : '',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      return {
        reply: typeof (parsed.reply ?? parsed.followUp) === 'string' ? String(parsed.reply ?? parsed.followUp).trim() : '',
        suggestedAnswers: normaliseTextList(parsed.suggestedAnswers ?? parsed.suggestions),
        factUpdates: normaliseFactUpdates(parsed.factUpdates),
        questionTargets: parsed.questionTargets ?? parsed.nextFields,
      };
    } catch {
      // Continue to the next provider-format fallback.
    }
  }

  const plainReply = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return { reply: plainReply.startsWith('{') ? '' : plainReply, suggestedAnswers: [], factUpdates: [], questionTargets: [] };
}

function buildStateInstruction(stateValue: unknown, language: IntakeLanguage): string {
  const state = parseIntakeState(stateValue);
  const ledger = Object.fromEntries(INTAKE_FACT_IDS.map((id) => [id, state.facts[id]]));
  return [
    `Output language: ${language === 'ru' ? 'Russian' : language === 'ka' ? 'Georgian' : 'English'}.`,
    `Conversation turn: ${state.turn + 1} of 7.`,
    `Allowed fact fields: ${JSON.stringify(INTAKE_FACT_DEFINITIONS)}.`,
    `Current fact ledger: ${JSON.stringify(ledger)}.`,
    'The last user message is the only source for factUpdates. Use earlier messages only as context.',
  ].join('\n');
}

async function requestProvider(
  apiKey: string,
  messages: Array<{ role: 'assistant' | 'system' | 'user'; content: string }>,
): Promise<string> {
  const provider = await fetch(process.env.CHAT_API_URL ?? 'https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.AI_INTAKE_MODEL ?? process.env.CHAT_API_MODEL ?? 'gemini-3.7-flash',
      messages,
      max_tokens: 1_600,
      temperature: 0.25,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ai_now_intake_turn',
          strict: true,
          schema: INTAKE_RESPONSE_SCHEMA,
        },
      },
      stream: false,
    }),
  });

  if (!provider.ok) throw new Error(`AI intake provider error: ${provider.status}`);
  const payload = await provider.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI intake provider returned an empty response.');
  return content.trim();
}

function requestedTargetsMatch(value: unknown, targets: IntakeFactId[]): boolean {
  if (!Array.isArray(value)) return false;
  const requested = [...new Set(value.filter((id): id is IntakeFactId => (
    typeof id === 'string' && INTAKE_FACT_IDS.includes(id as IntakeFactId)
  )))].slice(0, 1);
  return requested.length === targets.length && requested.every((id, index) => id === targets[index]);
}

function chooseReply(parsed: ParsedProviderResponse, targets: IntakeFactId[], language: IntakeLanguage, state: ReturnType<typeof parseIntakeState>): string {
  const fallback = buildFallbackQuestion(targets, language, state);
  if (targets.length === 0) {
    return language === 'ka'
      ? 'საკმარისი სანდო მონაცემი ჯერ არ გვაქვს დასკვნისთვის. დააზუსტეთ ის ფაქტი, რომლის გაზომვაც ყველაზე მარტივად შეგიძლიათ.'
      : language === 'ru'
        ? 'Для вывода пока недостаточно надёжных данных. Уточните факт, который вам проще всего измерить.'
        : 'There is not enough reliable information for a conclusion yet. Please clarify the fact that is easiest for you to measure.';
  }
  const usable = parsed.reply.length > 0
    && parsed.reply.includes('?')
    && !hasEmptyAcknowledgementPrefix(parsed.reply)
    && requestedTargetsMatch(parsed.questionTargets, targets);
  return usable ? parsed.reply : fallback;
}

export async function POST(request: NextRequest): Promise<Response> {
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json() as { messages?: unknown; intakeState?: unknown };
    if (!Array.isArray(body.messages)
      || body.messages.length === 0
      || body.messages.length > MAX_MESSAGES
      || !body.messages.every(isIntakeMessage)
      || body.messages.at(-1)?.role !== 'user') {
      return NextResponse.json({ error: 'Invalid conversation.' }, { status: 400 });
    }

    const messages = body.messages as IntakeMessage[];
    const language = getLanguage(messages);
    const previousState = parseIntakeState(body.intakeState);
    const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';

    let parsed: ParsedProviderResponse = {
      reply: '',
      suggestedAnswers: [],
      factUpdates: [],
      questionTargets: [],
    };

    const apiKey = process.env.CHAT_API_KEY;
    if (apiKey) {
      try {
        const rawContent = await requestProvider(apiKey, [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: buildStateInstruction(previousState, language) },
          ...messages.slice(-10),
        ]);
        parsed = parseProviderResponse(rawContent);
      } catch (err) {
        console.warn('AI intake provider request failed, falling back to deterministic controller:', err);
      }
    }

    const { state, targets } = advanceIntakeState(
      previousState,
      parsed.factUpdates,
      parsed.questionTargets,
      latestUserMessage,
    );

    const content = state.complete ? buildFinalBrief(state, language) : chooseReply(parsed, targets, language, state);
    const suggestions = state.complete
      ? []
      : parsed.suggestedAnswers.length === 3
        ? parsed.suggestedAnswers
        : fallbackSuggestions(language, targets, state);

    return NextResponse.json({
      content,
      suggestions,
      analysis: publicFactSummary(state),
      intakeState: state,
      progress: intakeProgress(state),
    });
  } catch (error) {
    console.error('AI intake request failed:', error);
    return NextResponse.json({ error: 'AI intake request failed.' }, { status: 500 });
  }
}
