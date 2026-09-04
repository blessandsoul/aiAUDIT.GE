import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
    content: z.string().trim().min(1).max(2_000),
  })).min(2).max(32),
  intakeState: z.unknown(),
}).strict();

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = submissionMap.get(ip);
  if (!entry || now > entry.resetAt) {
    submissionMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SUBMISSIONS;
}

export async function POST(request: NextRequest): Promise<Response> {
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: 'Too many submissions.' }, { status: 429 });
  }

  try {
    const parsed = leadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid lead data.' }, { status: 400 });
    }
    if (parsed.data.website) return NextResponse.json({ ok: true });

    const phone = normaliseLeadPhone(parsed.data.phone);
    const hasUserAnswer = parsed.data.messages.some((message) => message.role === 'user');
    if (!phone || !hasUserAnswer || !isCompleteIntakeState(parsed.data.intakeState)) {
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
