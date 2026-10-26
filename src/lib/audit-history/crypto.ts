import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { HistoryError } from './types.ts';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const issuedNonces = new Set<string>();

export type AssociatedData = {
  userId: string;
  accountId: string;
  id: string;
  revision: number;
  schemaVersion: number;
};

export type EncryptedPayload = {
  nonce: Uint8Array;
  ciphertext: Uint8Array;
  tag: Uint8Array;
};

function invalidInput(): never {
  throw new HistoryError(400, 'AUDIT_HISTORY_INVALID_INPUT');
}

function keyBytes(key: Uint8Array): Buffer {
  if (!(key instanceof Uint8Array) || key.byteLength !== KEY_BYTES) invalidInput();
  return Buffer.from(key);
}

function associatedDataBytes(aad: Uint8Array): Buffer {
  if (!(aad instanceof Uint8Array) || aad.byteLength === 0 || aad.byteLength > 2048) invalidInput();
  return Buffer.from(aad);
}

function nextNonce(): Buffer {
  // The nonce is never accepted from a caller.  The in-process set also makes
  // accidental reuse fail closed if a broken RNG ever repeats a value.
  for (;;) {
    const nonce = randomBytes(NONCE_BYTES);
    const encoded = nonce.toString('base64url');
    if (issuedNonces.has(encoded)) continue;
    issuedNonces.add(encoded);
    if (issuedNonces.size > 10_000) {
      const first = issuedNonces.values().next().value;
      if (typeof first === 'string') issuedNonces.delete(first);
    }
    return nonce;
  }
}

export function makeAssociatedData(input: AssociatedData): Uint8Array {
  if (
    !input ||
    typeof input.userId !== 'string' ||
    typeof input.accountId !== 'string' ||
    typeof input.id !== 'string' ||
    !Number.isSafeInteger(input.revision) ||
    input.revision < 1 ||
    !Number.isSafeInteger(input.schemaVersion) ||
    input.schemaVersion !== 1
  ) invalidInput();
  const encoded = JSON.stringify({
    schemaVersion: input.schemaVersion,
    userId: input.userId,
    accountId: input.accountId,
    id: input.id,
    revision: input.revision,
  });
  if (encoded.length > 2048) invalidInput();
  return Buffer.from(encoded, 'utf8');
}

export function encryptPayload(
  value: string | Uint8Array,
  key: Uint8Array,
  aad: Uint8Array,
  ...unexpected: unknown[]
): EncryptedPayload {
  if (unexpected.length > 0) invalidInput();
  if (typeof value !== 'string' && !(value instanceof Uint8Array)) invalidInput();
  const plaintext = typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value);
  const nonce = nextNonce();
  const encryptionKey = keyBytes(key);
  const additionalData = associatedDataBytes(aad);
  try {
    const cipher = createCipheriv(ALGORITHM, encryptionKey, nonce);
    cipher.setAAD(additionalData);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    if (tag.byteLength !== TAG_BYTES) throw new Error('invalid authentication tag');
    return {
      nonce: Uint8Array.from(nonce),
      ciphertext: Uint8Array.from(ciphertext),
      tag: Uint8Array.from(tag),
    };
  } catch {
    throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
  }
}

export function decryptPayload(
  payload: EncryptedPayload,
  key: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  try {
    if (
      !payload ||
      !(payload.nonce instanceof Uint8Array) ||
      payload.nonce.byteLength !== NONCE_BYTES ||
      !(payload.tag instanceof Uint8Array) ||
      payload.tag.byteLength !== TAG_BYTES ||
      !(payload.ciphertext instanceof Uint8Array)
    ) throw new Error('invalid encrypted payload');
    const decipher = createDecipheriv(ALGORITHM, keyBytes(key), Buffer.from(payload.nonce));
    decipher.setAAD(associatedDataBytes(aad));
    decipher.setAuthTag(Buffer.from(payload.tag));
    return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext)), decipher.final()]);
  } catch {
    throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
  }
}
