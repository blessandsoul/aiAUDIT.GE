import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyState } from '@/lib/audit-session';

import {
  buildIntakeLeadTelegramMessages,
  isCompleteIntakeState,
  normaliseLeadPhone,
  sendIntakeLeadToTelegram,
} from '@/lib/ai-intake-lead';

const MAX_SUBMISSIONS = 3;
const WINDOW_MS = 60 * 60 * 1_000;
const submissionMap = new Map<string, { count: number; resetAt: number }>();

const leadSchema = z.object({
  phone: z.string().max(40),
  consent: z.literal(true),
  website: z.string().max(0).optional(),
  messages: z.array(z.object({
    role: z.enum(['assistant', 'user']),
    content: z.string().trim().min(1).max(20_000),
  })).min(2).max(70),
  intakeState: z.unknown(),
}).strict();

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of submissionMap) if (value.resetAt < now) submissionMap.delete(key);
  const entry = submissionMap.get(ip);
  if (!entry || now > entry.resetAt) {
    submissionMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SUBMISSIONS;
}

export async function POST(request: NextRequest): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.NEXT_PUBLIC_SITE_URL) return NextResponse.json({ error: 'Origin rejected' }, { status: 403 });
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: 'Too many submissions.' }, { status: 429 });
  }

  try {
    const body = await request.text();
    if (Buffer.byteLength(body) > 350_000) return NextResponse.json({ error: 'Request too large.' }, { status: 413 });
    const parsed = leadSchema.safeParse(JSON.parse(body));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid lead data.' }, { status: 400 });
    }
    if (parsed.data.website) return NextResponse.json({ ok: true });

    const phone = normaliseLeadPhone(parsed.data.phone);
    const hasUserAnswer = parsed.data.messages.some((message) => message.role === 'user');
    if (!phone || !hasUserAnswer || !verifyState(parsed.data.intakeState) || !isCompleteIntakeState(parsed.data.intakeState)) {
      return NextResponse.json({ error: 'The brief is incomplete.' }, { status: 400 });
    }

    const { leadId, chunks } = buildIntakeLeadTelegramMessages({
      phone,
      messages: parsed.data.messages,
      intakeState: parsed.data.intakeState,
      receivedAt: new Date(),
    });
    await sendIntakeLeadToTelegram(chunks);
    return NextResponse.json({ ok: true, leadId });
  } catch {
    return NextResponse.json({ error: 'Lead delivery failed.' }, { status: 503 });
  }
}
