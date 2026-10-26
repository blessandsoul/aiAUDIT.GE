import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IntakeState } from './audit-engine.ts';

const SIGNING_DOMAIN = 'aiaudit-evidence-repair-v4';
const MAX_LIVE_AGE_MS = 12 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 1000;
const SIGNING_CONFIGURATION_ERROR = 'Audit signing is not configured';

function signingKey() {
  const key = process.env.AUDIT_SESSION_SECRET || process.env.CHAT_API_KEY;
  if (!key || key.length < 24) throw new Error(SIGNING_CONFIGURATION_ERROR);
  return createHmac('sha256', key).update(SIGNING_DOMAIN).digest();
}

function digest(s: IntakeState, timestamp: string) {
  const { proof: _proof, ...payload } = s;
  void _proof;
  return createHmac('sha256', signingKey()).update(timestamp + '.' + JSON.stringify(payload)).digest('hex');
}

export function signState(s: IntakeState): IntakeState {
  const timestamp = String(Date.now());
  return { ...s, proof: timestamp + '.' + digest(s, timestamp) };
}

function stateShape(value: unknown): value is IntakeState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const s = value as IntakeState;
  return s.version === 2 && typeof s.proof === 'string' && Array.isArray(s.history) && typeof s.turn === 'number';
}

export function checkAuditStateProof(value: unknown, nowMs = Date.now()):
  | { status: 'valid'; state: IntakeState }
  | { status: 'expired' | 'invalid' | 'unavailable' } {
  if (!stateShape(value)) return { status: 'invalid' };
  const state = value as IntakeState;
  const match = /^(\d+)\.([a-f0-9]{64})$/.exec(state.proof!);
  if (!match || match[0].length !== state.proof!.length) return { status: 'invalid' };
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) return { status: 'invalid' };

  let expected: Buffer;
  try {
    expected = Buffer.from(digest(state, match[1]), 'hex');
  } catch {
    return { status: 'unavailable' };
  }
  const received = Buffer.from(match[2], 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return { status: 'invalid' };

  if (timestamp > nowMs + FUTURE_TOLERANCE_MS) return { status: 'invalid' };
  if (nowMs - timestamp > MAX_LIVE_AGE_MS) return { status: 'expired' };
  return { status: 'valid', state };
}

export function verifyState(value: unknown): value is IntakeState {
  const result = checkAuditStateProof(value);
  if (result.status === 'unavailable') throw new Error(SIGNING_CONFIGURATION_ERROR);
  return result.status === 'valid';
}
