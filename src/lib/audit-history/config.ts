import path from 'node:path';

import { HistoryError } from './types.ts';

export type AuditHistoryRetention = 'owner_delete' | Readonly<{ days: 90 | 365 }>;

export type AuditHistoryKeyring = Readonly<{
  activeKeyId: string;
  keys: ReadonlyMap<string, Uint8Array>;
}>;

export type AuditHistoryConfig = Readonly<{
  enabled: true;
  storageDir: string;
  keyring: AuditHistoryKeyring;
  retention: AuditHistoryRetention;
  issuer: string;
  jwksUrl: string;
}>;

export type DisabledAuditHistoryConfig = Readonly<{ enabled: false }>;

export type AuditHistoryConfigResult = AuditHistoryConfig | DisabledAuditHistoryConfig;

/** A generic, non-secret configuration failure for the unavailable response path. */
export class AuditHistoryConfigError extends HistoryError {
  readonly code = 'AUDIT_HISTORY_CONFIG_INVALID';

  constructor() {
    super(503, 'AUDIT_HISTORY_CONFIG_INVALID');
    this.name = 'AuditHistoryConfigError';
    this.message = 'Audit history configuration unavailable';
  }
}

const DEFAULT_STORAGE_DIR = '/app/audit-data/history';
const DEFAULT_ISSUER = 'https://api.iai.ge';
const DEFAULT_JWKS_URL = 'https://api.iai.ge/.well-known/jwks.json';
const MAX_KEYRING_JSON_BYTES = 128 * 1024;
const KEY_BYTES = 32;

function invalid(): never {
  throw new AuditHistoryConfigError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSON.parse accepts the last value for duplicate properties. Configuration must
 * reject that ambiguity, so this small parser records object keys as it parses.
 */
export function parseJsonWithoutDuplicateProperties(input: string, maxBytes = MAX_KEYRING_JSON_BYTES): unknown {
  if (Buffer.byteLength(input, 'utf8') > maxBytes) invalid();

  let index = 0;
  const length = input.length;

  const skipWhitespace = () => {
    while (index < length && /\s/u.test(input[index]!)) index += 1;
  };

  const parseString = (): string => {
    if (input[index] !== '"') invalid();
    const start = index;
    index += 1;
    let escaped = false;
    for (; index < length; index += 1) {
      const char = input[index]!;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        index += 1;
        try {
          return JSON.parse(input.slice(start, index)) as string;
        } catch {
          invalid();
        }
      }
      if (char < ' ') invalid();
    }
    invalid();
  };

  const parseValue = (depth: number): unknown => {
    if (depth > 32) invalid();
    skipWhitespace();
    const char = input[index];
    if (char === '"') return parseString();
    if (char === '{') return parseObject(depth + 1);
    if (char === '[') return parseArray(depth + 1);
    if (input.startsWith('true', index)) {
      index += 4;
      return true;
    }
    if (input.startsWith('false', index)) {
      index += 5;
      return false;
    }
    if (input.startsWith('null', index)) {
      index += 4;
      return null;
    }
    const number = input.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u)?.[0];
    if (number) {
      index += number.length;
      const value = Number(number);
      if (!Number.isFinite(value)) invalid();
      return value;
    }
    invalid();
  };

  const parseObject = (depth: number): Record<string, unknown> => {
    if (input[index] !== '{') invalid();
    index += 1;
    skipWhitespace();
    const result = Object.create(null) as Record<string, unknown>;
    const keys = new Set<string>();
    if (input[index] === '}') {
      index += 1;
      return result;
    }
    while (index < length) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) invalid();
      keys.add(key);
      skipWhitespace();
      if (input[index] !== ':') invalid();
      index += 1;
      result[key] = parseValue(depth);
      skipWhitespace();
      if (input[index] === '}') {
        index += 1;
        return result;
      }
      if (input[index] !== ',') invalid();
      index += 1;
    }
    invalid();
  };

  const parseArray = (depth: number): unknown[] => {
    if (input[index] !== '[') invalid();
    index += 1;
    skipWhitespace();
    const result: unknown[] = [];
    if (input[index] === ']') {
      index += 1;
      return result;
    }
    while (index < length) {
      result.push(parseValue(depth));
      skipWhitespace();
      if (input[index] === ']') {
        index += 1;
        return result;
      }
      if (input[index] !== ',') invalid();
      index += 1;
      skipWhitespace();
    }
    invalid();
  };

  const result = parseValue(0);
  skipWhitespace();
  if (index !== length) invalid();
  return result;
}

function decodeCanonicalBase64(value: unknown): Uint8Array | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/u.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== KEY_BYTES || bytes.toString('base64') !== value) return null;
  return Uint8Array.from(bytes);
}

function decodeCanonicalBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) return null;
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const bytes = Buffer.from(padded, 'base64');
  const canonical = bytes.toString('base64url');
  if (canonical !== value) return null;
  return Uint8Array.from(bytes);
}

function secretMatchesKey(secret: string, key: Uint8Array): boolean {
  const raw = Buffer.from(secret, 'utf8');
  if (raw.length === key.length && raw.equals(Buffer.from(key))) return true;

  const base64 = decodeCanonicalBase64(secret);
  if (base64 && Buffer.from(base64).equals(Buffer.from(key))) return true;

  const base64Url = decodeCanonicalBase64Url(secret);
  return !!base64Url && Buffer.from(base64Url).equals(Buffer.from(key));
}

function parseKeyring(source: Record<string, string | undefined>): AuditHistoryKeyring {
  const raw = source.AUDIT_HISTORY_KEYS_JSON;
  if (typeof raw !== 'string' || raw.length === 0) invalid();
  let parsed: unknown;
  try {
    parsed = parseJsonWithoutDuplicateProperties(raw);
  } catch (error) {
    if (error instanceof AuditHistoryConfigError) throw error;
    invalid();
  }
  if (!isRecord(parsed)) invalid();

  const ids = Object.keys(parsed);
  if (ids.length < 1 || ids.length > 4) invalid();
  const keys = new Map<string, Uint8Array>();
  for (const id of ids) {
    if (!/^[A-Za-z0-9_-]{1,32}$/u.test(id)) invalid();
    const bytes = decodeCanonicalBase64(parsed[id]);
    if (!bytes) invalid();
    keys.set(id, bytes);
  }

  const activeKeyId = source.AUDIT_HISTORY_ACTIVE_KEY_ID;
  if (typeof activeKeyId !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/u.test(activeKeyId) || !keys.has(activeKeyId)) invalid();

  for (const secretName of ['AUDIT_SESSION_SECRET', 'CHAT_API_KEY'] as const) {
    const secret = source[secretName];
    if (typeof secret !== 'string') continue;
    for (const value of keys.values()) {
      if (secretMatchesKey(secret, value)) invalid();
    }
  }

  return Object.freeze({ activeKeyId, keys });
}

function parseEndpoint(value: unknown, production: boolean): URL {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) invalid();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    invalid();
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.origin === 'null') invalid();
  if (production && url.protocol !== 'https:') invalid();
  if (!production && url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) invalid();
  return url;
}

export function validateAuditHistoryEndpoints(
  issuer: string,
  jwksUrl: string,
  nodeEnv?: string,
): Readonly<{ issuer: string; jwksUrl: string }> {
  const production = nodeEnv === 'production';
  const issuerUrl = parseEndpoint(issuer, production);
  const jwksUrlObject = parseEndpoint(jwksUrl, production);
  if (issuerUrl.origin !== jwksUrlObject.origin) invalid();
  // Preserve the issuer spelling because it is an exact JWT claim. URL parsing
  // is validation here; silently adding a trailing slash would reject otherwise
  // valid tokens issued with the configured value.
  return Object.freeze({ issuer, jwksUrl });
}

export function readAuditHistoryConfig(
  source: Record<string, string | undefined> = process.env,
): AuditHistoryConfigResult {
  const enabled = source.AUDIT_HISTORY_ENABLED;
  if (enabled === undefined || enabled === 'false') return { enabled: false };
  if (enabled !== 'true') invalid();

  const storageDir = source.AUDIT_HISTORY_STORAGE_DIR ?? DEFAULT_STORAGE_DIR;
  if (typeof storageDir !== 'string' || storageDir.length === 0 || storageDir.includes('\0') || !path.isAbsolute(storageDir)) invalid();

  const retentionValue = source.AUDIT_HISTORY_RETENTION;
  let retention: AuditHistoryRetention;
  if (retentionValue === 'owner_delete') retention = 'owner_delete';
  else if (retentionValue === '90d_after_update') retention = Object.freeze({ days: 90 });
  else if (retentionValue === '365d_after_update') retention = Object.freeze({ days: 365 });
  else invalid();

  const issuer = source.AUDIT_HISTORY_IDP_ISSUER ?? DEFAULT_ISSUER;
  const jwksUrl = source.AUDIT_HISTORY_JWKS_URL ?? DEFAULT_JWKS_URL;
  const endpoints = validateAuditHistoryEndpoints(issuer, jwksUrl, source.NODE_ENV);
  const keyring = parseKeyring(source);

  return Object.freeze({
    enabled: true,
    storageDir,
    keyring,
    retention,
    issuer: endpoints.issuer,
    jwksUrl: endpoints.jwksUrl,
  });
}
