import test from 'node:test';
import assert from 'node:assert/strict';

import { createIntakeState } from '../src/lib/audit-engine.ts';
import { checkAuditStateProof, signState, verifyState } from '../src/lib/audit-session.ts';

const SECRET = 'fake-audit-session-secret-for-tests-2026';
const OTHER_SECRET = 'fake-other-audit-session-secret-2026';
const HOUR = 60 * 60 * 1000;

function withSecret(secret, callback) {
  const oldAudit = process.env.AUDIT_SESSION_SECRET;
  const oldChat = process.env.CHAT_API_KEY;
  if (secret === undefined) {
    delete process.env.AUDIT_SESSION_SECRET;
    delete process.env.CHAT_API_KEY;
  } else {
    process.env.AUDIT_SESSION_SECRET = secret;
    delete process.env.CHAT_API_KEY;
  }
  try {
    return callback();
  } finally {
    if (oldAudit === undefined) delete process.env.AUDIT_SESSION_SECRET;
    else process.env.AUDIT_SESSION_SECRET = oldAudit;
    if (oldChat === undefined) delete process.env.CHAT_API_KEY;
    else process.env.CHAT_API_KEY = oldChat;
  }
}

function signedAt(timestamp, state = createIntakeState('en')) {
  const oldNow = Date.now;
  Date.now = () => timestamp;
  try {
    return signState(state);
  } finally {
    Date.now = oldNow;
  }
}

test('fresh signed state is valid and returns the original state object', () => withSecret(SECRET, () => {
  const now = Date.now();
  const signed = signedAt(now);
  const result = checkAuditStateProof(signed, now);
  assert.equal(result.status, 'valid');
  assert.equal(result.state, signed);
  assert.equal(verifyState(signed), true);
}));

test('tampering with a signed body is invalid even while the original proof is fresh', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const signed = signedAt(now);
  const tampered = { ...signed, turn: signed.turn + 1 };
  assert.deepEqual(checkAuditStateProof(tampered, now), { status: 'invalid' });
  assert.equal(verifyState(tampered), false);
}));

test('a correctly signed old state is expired, while an expired forged state is invalid', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const signed = signedAt(now - 12 * HOUR - 1);
  assert.equal(checkAuditStateProof(signed, now).status, 'expired');
  const forged = { ...signed, complete: true };
  assert.deepEqual(checkAuditStateProof(forged, now), { status: 'invalid' });
}));

test('a signed proof five seconds in the future is tolerated, but a farther future proof is invalid', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  assert.equal(checkAuditStateProof(signedAt(now + 5_000), now).status, 'valid');
  assert.equal(checkAuditStateProof(signedAt(now + 5_001), now).status, 'invalid');
}));

test('the exact twelve-hour boundary is valid and one millisecond beyond it is expired', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  assert.equal(checkAuditStateProof(signedAt(now - 12 * HOUR), now).status, 'valid');
  assert.equal(checkAuditStateProof(signedAt(now - 12 * HOUR - 1), now).status, 'expired');
}));

test('proof format is exact and rejects a suffix', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const signed = signedAt(now);
  assert.equal(checkAuditStateProof({ ...signed, proof: `${signed.proof}.suffix` }, now).status, 'invalid');
}));

test('proofs with terminal line terminators are invalid and verifyState rejects them', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const signed = signedAt(now);
  for (const suffix of ['\n', '\r\n', '\u2028', '\u2029']) {
    const state = { ...signed, proof: signed.proof + suffix };
    assert.equal(checkAuditStateProof(state, now).status, 'invalid', JSON.stringify(suffix));
    assert.equal(verifyStateAt(state, now), false, JSON.stringify(suffix));
  }
}));

function verifyStateAt(state, now) {
  const oldNow = Date.now;
  Date.now = () => now;
  try {
    return verifyState(state);
  } finally {
    Date.now = oldNow;
  }
}

test('missing or short signing configuration is unavailable and verifyState keeps its fixed error', () => {
  const now = 1_800_000_000_000;
  withSecret(SECRET, () => {
    const signed = signedAt(now);
    withSecret(undefined, () => {
      assert.deepEqual(checkAuditStateProof(signed, now), { status: 'unavailable' });
      assert.throws(() => verifyState(signed), { message: 'Audit signing is not configured' });
    });
    withSecret('short', () => assert.deepEqual(checkAuditStateProof(signed, now), { status: 'unavailable' }));
  });
});

test('unknown signed fields round-trip without reconstruction or loss', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const state = createIntakeState('en');
  state.extraProofData = { first: 'one', nested: { keep: true, order: ['a', 'b'] } };
  const signed = signedAt(now, state);
  const result = checkAuditStateProof(signed, now);
  assert.equal(result.status, 'valid');
  assert.deepEqual(result.state.extraProofData, state.extraProofData);
}));

test('reordering nested signed keys changes the authenticated payload', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const state = createIntakeState('en');
  state.extraProofData = { first: 'one', second: 'two' };
  const signed = signedAt(now, state);
  const reordered = { ...signed, extraProofData: { second: 'two', first: 'one' } };
  assert.equal(checkAuditStateProof(reordered, now).status, 'invalid');
}));

test('a different fake signing key cannot authenticate the state', () => withSecret(SECRET, () => {
  const now = 1_800_000_000_000;
  const signed = signedAt(now);
  withSecret(OTHER_SECRET, () => assert.equal(checkAuditStateProof(signed, now).status, 'invalid'));
}));
