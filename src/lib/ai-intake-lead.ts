import { createHash } from 'node:crypto';

import {
  INTAKE_FACT_IDS,
  buildFinalBrief,
  intakeProgress,
  parseIntakeState,
  type IntakeLanguage,
  type IntakeState,
} from '@/lib/ai-intake-controller';

export type IntakeLeadMessage = {
  role: 'assistant' | 'user';
  content: string;
};

const TELEGRAM_TEXT_LIMIT = 3_900;

export function normaliseLeadPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !/^[+\d\s().-]+$/.test(trimmed)) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) return null;
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

export function intakeLanguageFromMessages(messages: IntakeLeadMessage[]): IntakeLanguage {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  if (/[Ѐ-ӿ]/.test(latestUserMessage)) return 'ru';
  if (/[Ⴀ-ჿ]/.test(latestUserMessage)) return 'ka';
  return 'en';
}

export function isCompleteIntakeState(value: unknown): value is IntakeState {
  const state = parseIntakeState(value);
  return INTAKE_FACT_IDS.every((id) => (
    state.facts[id].status !== 'missing' && state.facts[id].status !== 'partial'
  ));
}

function splitTelegramText(text: string): string[] {
  if (text.length <= TELEGRAM_TEXT_LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > TELEGRAM_TEXT_LIMIT) {
    const candidate = remaining.slice(0, TELEGRAM_TEXT_LIMIT);
    const breakAt = Math.max(candidate.lastIndexOf('\n\n'), candidate.lastIndexOf('\n'));
    const splitAt = breakAt > TELEGRAM_TEXT_LIMIT * 0.55 ? breakAt : TELEGRAM_TEXT_LIMIT;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function buildIntakeLeadTelegramMessages(params: {
  phone: string;
  messages: IntakeLeadMessage[];
  intakeState: unknown;
  receivedAt: Date;
}): { leadId: string; chunks: string[] } {
  const state = parseIntakeState(params.intakeState);
  const language = intakeLanguageFromMessages(params.messages);
  const progress = intakeProgress(state);
  const userAnswers = params.messages
    .filter((message) => message.role === 'user')
    .map((message, index) => `${index + 1}. ${message.content.trim()}`)
    .join('\n\n');
  const brief = buildFinalBrief(state, language);
  const leadId = createHash('sha256')
    .update(`${params.phone}\n${userAnswers}`)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();
  const receivedAt = params.receivedAt.toLocaleString('ka-GE', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const header = [
    '🧭 ახალი AI ბრიფი (aiAUDIT.ge)',
    '',
    `ლიდის კოდი: ${leadId}`,
    `ტელეფონი: ${params.phone}`,
    `მიღებულია: ${receivedAt}`,
    `შევსებულია: ${progress.closed}/${progress.total}`,
    '',
    'შეჯამებული ბრიფი',
    brief,
  ].join('\n');
  const transcript = ['კლიენტის პასუხები', '', userAnswers].join('\n');
  const chunks = [
    ...splitTelegramText(header),
    ...splitTelegramText(transcript),
  ];

  return { leadId, chunks };
}

export async function sendIntakeLeadToTelegram(chunks: string[]): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) throw new Error('Telegram is not configured');

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  for (const text of chunks) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) throw new Error(`Telegram rejected an intake lead: ${response.status}`);
  }
}
