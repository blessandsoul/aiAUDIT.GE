import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IntakeState } from './audit-engine.ts';
function signingKey() {
  const key = process.env.AUDIT_SESSION_SECRET || process.env.CHAT_API_KEY;
  if (!key || key.length < 24) throw new Error('Audit signing is not configured');
  return createHmac('sha256', key).update('aiaudit-evidence-repair-v4').digest();
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
export function verifyState(value: unknown): value is IntakeState {
  if (!value || typeof value !== 'object') return false;
  const s = value as IntakeState;
  if (s.version !== 2 || typeof s.proof !== 'string' || !Array.isArray(s.history) || typeof s.turn !== 'number') return false;
  const [timestamp, hash] = s.proof.split('.');
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(hash ?? '') || Math.abs(Date.now() - Number(timestamp)) > 12 * 60 * 60 * 1000) return false;
  const expected = Buffer.from(digest(s, timestamp), 'hex');
  return timingSafeEqual(expected, Buffer.from(hash, 'hex'));
}
