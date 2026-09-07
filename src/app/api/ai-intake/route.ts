import { NextRequest, NextResponse } from 'next/server';
import { extract } from '@/lib/audit-extractor';
import { advanceAudit, assess, auditTurnLimit, createIntakeState, intakeProgress, languageOf, publicFactSummary, questionFor, type Extraction, type IntakeState } from '@/lib/audit-engine';
import { buildFinalBrief } from '@/lib/audit-report';
import { signState, verifyState } from '@/lib/audit-session';
import { readAuditBody, AuditRequestTooLarge } from '@/lib/audit-request';

const EMPTY: Extraction = { focus: 'discovery', focusEvidence: '', updates: [], nextField: null };
const windows = new Map<string, { count: number; until: number }>();
function limited(request: NextRequest) {
  const now = Date.now(), ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  for (const [key, value] of windows) if (value.until < now) windows.delete(key);
  const entry = windows.get(ip) || { count: 0, until: now + 60 * 60 * 1000 };
  entry.count++; windows.set(ip, entry);
  return entry.count > 100;
}
function sensitive(message: string) {
  return /(?:sk-[\w-]{16,}|-----BEGIN .*PRIVATE KEY|(?:api[_ -]?key|password|пароль|პაროლი)\s*[:=]\s*\S{6,}|\b\d{13,19}\b)/iu.test(message);
}
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin && origin !== process.env.NEXT_PUBLIC_SITE_URL) return NextResponse.json({ error: 'Origin rejected' }, { status: 403 });
  if (limited(request)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  try {
    const bytes = await readAuditBody(request);
    const input = JSON.parse(bytes) as { messages?: unknown; intakeState?: unknown; action?: string; thinking?: unknown; mode?: unknown };
    if (input.mode !== undefined && input.mode !== 'quick' && input.mode !== 'deep') return NextResponse.json({error:'Invalid audit mode'},{status:400});
    if (input.thinking !== undefined && typeof input.thinking !== 'boolean') return NextResponse.json({ error: 'Invalid thinking mode' }, { status: 400 });
    const last = Array.isArray(input.messages) ? input.messages.at(-1) : null;
    if (!last || last.role !== 'user' || typeof last.content !== 'string' || !last.content.trim() || last.content.length > 3000) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    if (input.intakeState && !verifyState(input.intakeState)) return NextResponse.json({ error: 'Audit session changed or expired. Start a new audit.' }, { status: 409 });
    const previous = input.intakeState as IntakeState | undefined;
    if (previous && input.mode && input.mode !== (previous.mode || 'quick')) return NextResponse.json({error:'Start a new audit to change mode'},{status:409});
    const s = previous || createIntakeState(languageOf(last.content), input.mode === 'deep' ? 'deep' : 'quick');
    if (s.turn >= auditTurnLimit(s) + 6) return NextResponse.json({ error: 'Start a new audit to continue' }, { status: 409 });
    if (sensitive(last.content)) return NextResponse.json({ error: 'Please remove passwords, keys or payment data and describe only the process.' }, { status: 400 });
    const finish = input.action === 'finish';
    const extracted = finish ? EMPTY : await extract(s, last.content, input.thinking === true);
    const next = advanceAudit(s, last.content.trim(), extracted, finish);
    const question = questionFor(next);
    const content = next.complete ? buildFinalBrief(next, next.language) : question!.content;
    next.history.push({ role: 'assistant', content: next.complete ? 'Audit report provided. The client may correct facts.' : content });
    return NextResponse.json({ content, suggestions: question?.suggestions || [], analysis: publicFactSummary(next), intakeState: signState(next), progress: intakeProgress(next), assessment: next.complete ? assess(next) : null });
  } catch (error) {
    if (error instanceof AuditRequestTooLarge) return NextResponse.json({error:'Request too large'},{status:413});
    // No fabricated fallback progress after a provider error; retry the same turn.
    console.warn('Audit turn rejected:', error instanceof Error ? error.message.slice(0, 350) : 'invalid response');
    return NextResponse.json({ error: 'Could not process this answer. Please retry.' }, { status: 503 });
  }
}
