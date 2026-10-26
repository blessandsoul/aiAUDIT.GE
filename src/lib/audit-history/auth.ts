import {
  createRemoteJWKSet,
  customFetch,
  jwtVerify,
  type FetchImplementation,
  type JWTPayload,
  type RemoteJWKSet,
} from 'jose';

import {
  AuditHistoryConfigError,
  parseJsonWithoutDuplicateProperties,
  validateAuditHistoryEndpoints,
} from './config.ts';
import { HistoryError } from './types.ts';
import type { HistoryPrincipal } from './types.ts';

export type AuditHistoryScope = 'audit:read' | 'audit:write';

export type AuditHistoryAuthConfig = Readonly<{
  issuer: string;
  jwksUrl: string;
}>;

export type AuditHistoryAuthOptions = Readonly<{
  fetch?: typeof fetch;
  now?: () => number;
}>;

export class AuditHistoryAuthError extends HistoryError {
  declare readonly status: 401 | 403 | 503;
  readonly retryable: boolean;

  constructor(status: 401 | 403 | 503, code: string, message: string) {
    super(status, code);
    this.name = 'AuditHistoryAuthError';
    this.message = message;
    this.retryable = status === 503;
  }
}

const TOKEN_LIMIT_BYTES = 12 * 1024;
const JWKS_LIMIT_BYTES = 64 * 1024;
const JWKS_MAX_KEYS = 16;
const AUTH_AUDIENCE = 'aiaudit';
const SUPPORTED_HEADER_KEYS = new Set(['alg', 'kid', 'typ']);
const SUPPORTED_JWK_KEYS = new Set(['kty', 'crv', 'x', 'kid', 'alg', 'use', 'key_ops']);

class RemoteJwksError extends Error {
  constructor() {
    super('Remote JWKS unavailable');
    this.name = 'RemoteJwksError';
  }
}

type VerifiedClaims = JWTPayload & {
  sub: string;
  account_id: string;
  iat: number;
  exp: number;
  jti: string;
  scope: string[];
};

function unavailable(): never {
  throw new AuditHistoryAuthError(503, 'AUDIT_HISTORY_UNAVAILABLE', 'Audit history unavailable');
}

function unauthorized(code = 'AUDIT_HISTORY_AUTH_INVALID'): never {
  throw new AuditHistoryAuthError(401, code, 'Audit history authentication invalid');
}

function scopeDenied(): never {
  throw new AuditHistoryAuthError(403, 'AUDIT_HISTORY_SCOPE_DENIED', 'Audit history scope denied');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeCanonicalBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) unauthorized();
  const padded = value.replace(/-/gu, '+').replace(/_/gu, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const bytes = Buffer.from(padded, 'base64');
  if (bytes.toString('base64url') !== value) unauthorized();
  return Uint8Array.from(bytes);
}

function readAuthorizationToken(authorization: string | null): string {
  if (typeof authorization !== 'string') unauthorized('AUDIT_HISTORY_AUTH_REQUIRED');
  const match = /^Bearer ([^\s]+)$/iu.exec(authorization);
  if (!match) unauthorized('AUDIT_HISTORY_AUTH_INVALID');
  const token = match[1]!;
  if (Buffer.byteLength(token, 'utf8') > TOKEN_LIMIT_BYTES) unauthorized();
  const segments = token.split('.');
  if (segments.length !== 3 || segments.some((segment) => segment.length === 0)) unauthorized();
  return token;
}

function readProtectedHeader(token: string): { alg: 'EdDSA'; kid: string; typ: 'JWT' } {
  const encoded = token.slice(0, token.indexOf('.'));
  let parsed: unknown;
  try {
    const bytes = decodeCanonicalBase64Url(encoded);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    parsed = parseJsonWithoutDuplicateProperties(text, 16 * 1024);
  } catch (error) {
    if (error instanceof AuditHistoryAuthError) throw error;
    unauthorized();
  }
  if (!isRecord(parsed)) unauthorized();
  const keys = Object.keys(parsed);
  if (keys.length !== SUPPORTED_HEADER_KEYS.size || keys.some((key) => !SUPPORTED_HEADER_KEYS.has(key))) unauthorized();
  if (parsed.alg !== 'EdDSA' || parsed.typ !== 'JWT' || typeof parsed.kid !== 'string') unauthorized();
  if (!/^[\x21-\x7e]{1,128}$/u.test(parsed.kid)) unauthorized();
  return { alg: 'EdDSA', kid: parsed.kid, typ: 'JWT' };
}

function validateJwks(value: unknown): { keys: Array<Record<string, unknown>> } {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'keys') || !Array.isArray(value.keys)) throw new RemoteJwksError();
  if (value.keys.length === 0 || value.keys.length > JWKS_MAX_KEYS) throw new RemoteJwksError();

  const seenKids = new Set<string>();
  const keys: Array<Record<string, unknown>> = [];
  for (const item of value.keys) {
    if (!isRecord(item) || Object.keys(item).some((key) => !SUPPORTED_JWK_KEYS.has(key))) throw new RemoteJwksError();
    if (item.kty !== 'OKP' || item.crv !== 'Ed25519' || typeof item.kid !== 'string' || !/^[\x21-\x7e]{1,128}$/u.test(item.kid)) throw new RemoteJwksError();
    if (seenKids.has(item.kid)) throw new RemoteJwksError();
    seenKids.add(item.kid);
    if (typeof item.x !== 'string' || decodeJwkKey(item.x).length !== 32) throw new RemoteJwksError();
    if (item.alg !== undefined && item.alg !== 'EdDSA') throw new RemoteJwksError();
    if (item.use !== undefined && item.use !== 'sig') throw new RemoteJwksError();
    if (item.key_ops !== undefined && (!Array.isArray(item.key_ops) || item.key_ops.length !== 1 || item.key_ops[0] !== 'verify')) throw new RemoteJwksError();
    keys.push(item);
  }
  return { keys };
}

function decodeJwkKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) throw new RemoteJwksError();
  const bytes = Buffer.from(`${value.replace(/-/gu, '+').replace(/_/gu, '/')}=`, 'base64');
  if (bytes.length !== 32 || bytes.toString('base64url') !== value) throw new RemoteJwksError();
  return Uint8Array.from(bytes);
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && /^\d+$/u.test(contentLength) && Number(contentLength) > JWKS_LIMIT_BYTES) throw new RemoteJwksError();

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > JWKS_LIMIT_BYTES) throw new RemoteJwksError();
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const chunk = result.value;
      total += chunk.byteLength;
      if (total > JWKS_LIMIT_BYTES) {
        await reader.cancel();
        throw new RemoteJwksError();
      }
      chunks.push(chunk);
    }
  } catch (error) {
    if (error instanceof RemoteJwksError) throw error;
    throw new RemoteJwksError();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function makeJwksFetch(fetchImpl: typeof fetch | undefined, expectedUrl: string): FetchImplementation {
  return async (url, options) => {
    if (url !== expectedUrl || options.method !== 'GET' || options.redirect !== 'manual') throw new RemoteJwksError();
    const implementation = fetchImpl ?? globalThis.fetch;
    if (typeof implementation !== 'function') throw new RemoteJwksError();

    let response: Response;
    try {
      response = await implementation(expectedUrl, {
        method: 'GET',
        redirect: 'manual',
        headers: new Headers({ accept: 'application/json, application/jwk-set+json' }),
        signal: options.signal,
      });
    } catch {
      throw new RemoteJwksError();
    }
    if (response.status !== 200 || response.redirected || response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) throw new RemoteJwksError();

    try {
      const body = await readBoundedBody(response);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
      const parsed = parseJsonWithoutDuplicateProperties(text, JWKS_LIMIT_BYTES);
      const jwks = validateJwks(parsed);
      return new Response(JSON.stringify(jwks), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    } catch (error) {
      if (error instanceof RemoteJwksError) throw error;
      throw new RemoteJwksError();
    }
  };
}

function mapJoseError(error: unknown): never {
  if (error instanceof AuditHistoryAuthError) throw error;
  if (error instanceof RemoteJwksError) unavailable();
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : '';
  if (code === 'ERR_JWKS_NO_MATCHING_KEY' || code === 'ERR_JWKS_MULTIPLE_MATCHING_KEYS') unauthorized();
  if (code.startsWith('ERR_JWKS_')) unavailable();
  unauthorized();
}

function validateClaims(payload: JWTPayload, expectedIssuer: string, now: number): VerifiedClaims {
  if (!isRecord(payload)) unauthorized();
  if (payload.iss !== expectedIssuer || payload.aud !== AUTH_AUDIENCE) unauthorized();
  if (typeof payload.sub !== 'string' || payload.sub.length < 1 || payload.sub.length > 200) unauthorized();
  if (typeof payload.account_id !== 'string' || payload.account_id.length < 1 || payload.account_id.length > 200) unauthorized();
  if (typeof payload.jti !== 'string' || payload.jti.length < 1 || payload.jti.length > 200) unauthorized();
  const iat = payload.iat;
  const exp = payload.exp;
  if (typeof iat !== 'number' || typeof exp !== 'number' || !Number.isSafeInteger(iat) || !Number.isSafeInteger(exp)) unauthorized();
  if (exp <= iat || exp - iat > 300) unauthorized();
  if (iat > now + 5 || exp <= now - 5) unauthorized();
  if (!Array.isArray(payload.scope) || payload.scope.length === 0 || payload.scope.length > 8 || payload.scope.some((scope) => typeof scope !== 'string' || scope.length === 0 || scope.length > 64)) unauthorized();
  return payload as VerifiedClaims;
}

function authorizationFromRequest(request: Request | { headers: { get(name: string): string | null } }): string | null {
  if (!request || !request.headers || typeof request.headers.get !== 'function') return null;
  return request.headers.get('authorization');
}

export function createAuditHistoryAuth(
  config: AuditHistoryAuthConfig,
  options: AuditHistoryAuthOptions = {},
): Readonly<{
  verify(authorization: string | null, requiredScope: AuditHistoryScope): Promise<HistoryPrincipal>;
}> {
  let remoteJwks: RemoteJWKSet | null = null;
  let configFailure = false;
  let expectedIssuer = '';
  let expectedJwksUrl = '';
  try {
    const endpoints = validateAuditHistoryEndpoints(config.issuer, config.jwksUrl, process.env.NODE_ENV);
    expectedIssuer = endpoints.issuer;
    expectedJwksUrl = new URL(endpoints.jwksUrl).href;
    remoteJwks = createRemoteJWKSet(new URL(expectedJwksUrl), {
      cacheMaxAge: 300_000,
      cooldownDuration: 30_000,
      timeoutDuration: 2_000,
      [customFetch]: makeJwksFetch(options.fetch, expectedJwksUrl),
    });
  } catch (error) {
    if (error instanceof AuditHistoryConfigError || error instanceof TypeError) configFailure = true;
    else configFailure = true;
  }

  const verify = async (authorization: string | null, requiredScope: AuditHistoryScope): Promise<HistoryPrincipal> => {
    if (requiredScope !== 'audit:read' && requiredScope !== 'audit:write') unavailable();
    if (configFailure || !remoteJwks) unavailable();
    const token = readAuthorizationToken(authorization);
    readProtectedHeader(token);
    let currentSeconds: number | undefined;
    try {
      currentSeconds = options.now?.();
    } catch {
      unavailable();
    }
    const rawNow = currentSeconds === undefined ? Date.now() / 1000 : currentSeconds;
    const now = rawNow > 100_000_000_000 ? rawNow / 1000 : rawNow;
    if (!Number.isFinite(now)) unavailable();

    let result: { payload: JWTPayload };
    try {
      result = await jwtVerify(token, remoteJwks, {
        algorithms: ['EdDSA'],
        issuer: expectedIssuer,
        audience: AUTH_AUDIENCE,
        typ: 'JWT',
        requiredClaims: ['sub', 'account_id', 'iat', 'exp', 'jti', 'scope'],
        clockTolerance: 5,
        currentDate: new Date(now * 1000),
      });
    } catch (error) {
      mapJoseError(error);
    }
    const payload = validateClaims(result.payload, expectedIssuer, now);
    if (!payload.scope.includes(requiredScope)) scopeDenied();
    return Object.freeze({ userId: payload.sub, accountId: payload.account_id }) as HistoryPrincipal;
  };

  return Object.freeze({ verify });
}

export { authorizationFromRequest };
export type { HistoryPrincipal } from './types.ts';
