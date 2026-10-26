import assert from 'node:assert/strict';
import test from 'node:test';

const { decryptPayload, encryptPayload, makeAssociatedData } = await import('../src/lib/audit-history/crypto.ts');
const { HistoryError } = await import('../src/lib/audit-history/types.ts');

const key = new Uint8Array(32).fill(0x11);
const otherKey = new Uint8Array(32).fill(0x22);
const aad = makeAssociatedData({
  userId: 'user-one',
  accountId: 'account-one',
  id: 'case-one',
  revision: 1,
  schemaVersion: 1,
});

test('encrypts and decrypts payloads with a random twelve-byte nonce and sixteen-byte tag', () => {
  const first = encryptPayload('fixture secret report', key, aad);
  const second = encryptPayload('fixture secret report', key, aad);

  assert.equal(first.nonce.length, 12);
  assert.equal(first.tag.length, 16);
  assert.notDeepEqual(first.nonce, second.nonce);
  assert.equal(new TextDecoder().decode(decryptPayload(first, key, aad)), 'fixture secret report');
  assert.ok(!Buffer.concat([first.nonce, first.tag, first.ciphertext]).toString('utf8').includes('fixture secret report'));
});

test('rejects tampering, AAD swaps, and missing keys with fixed history errors', () => {
  const payload = encryptPayload('private transcript', key, aad);
  const swappedAad = makeAssociatedData({
    userId: 'other-user',
    accountId: 'account-one',
    id: 'case-one',
    revision: 1,
    schemaVersion: 1,
  });

  assert.throws(
    () => decryptPayload(payload, key, swappedAad),
    (error) => error instanceof HistoryError && error.status === 503 && error.code === 'AUDIT_HISTORY_KEY_FAILURE',
  );
  assert.throws(
    () => decryptPayload({ ...payload, ciphertext: Uint8Array.from(payload.ciphertext, (value, index) => index === 0 ? value ^ 1 : value) }, key, aad),
    (error) => error instanceof HistoryError && error.code === 'AUDIT_HISTORY_KEY_FAILURE',
  );
  assert.throws(
    () => decryptPayload(payload, otherKey, aad),
    (error) => error instanceof HistoryError && error.code === 'AUDIT_HISTORY_KEY_FAILURE',
  );
});

test('does not expose a caller-controlled nonce input', () => {
  assert.throws(
    () => encryptPayload('data', key, aad, { nonce: new Uint8Array(12) }),
    (error) => error instanceof HistoryError && error.code === 'AUDIT_HISTORY_INVALID_INPUT',
  );
});
