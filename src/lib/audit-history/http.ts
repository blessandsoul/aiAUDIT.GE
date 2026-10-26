import type { AuditHistoryScope } from './auth.ts';
import { authorizationFromRequest } from './auth.ts';
import { HistoryError, type HistoryPrincipal } from './types.ts';
import { createAuditHistoryService, AuditHistoryServiceError, type AuditHistoryExtractor, type AuditHistoryService } from './service.ts';
import {
  AuditHistoryValidationError,
  HISTORY_LIMITS,
  validateCursor,
  validateOperationBody,
  validatePathSegments,
  type HistoryOperation,
} from './validation.ts';
import type { HistoryStore } from './store.ts';

export const runtime = 'nodejs';

const BODY_TIMEOUT_MS = 5_000;
const MAX_OWNERS = 4_096;
const MAX_READS_PER_MINUTE = 600;
const MAX_WRITES_PER_MINUTE = 30;
const MAX_READ_CONCURRENCY = 8;
const MAX_WRITE_CONCURRENCY = 1;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;

export const AUDIT_HISTORY_BODY_LIMIT = HISTORY_LIMITS.maxBodyBytes;
export const AUDIT_HISTORY_UPLOAD_TIMEOUT_MS = BODY_TIMEOUT_MS;
export const AUDIT_HISTORY_RESPONSE_LIMIT = MAX_RESPONSE_BYTES;

const SAFE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUDIT_HISTORY_INVALID_INPUT: 'Invalid audit history request',
  AUDIT_HISTORY_AUTH_REQUIRED: 'Audit history authentication required',
  AUDIT_HISTORY_AUTH_INVALID: 'Audit history authentication invalid',
  AUDIT_HISTORY_SCOPE_DENIED: 'Audit history scope denied',
  AUDIT_HISTORY_NOT_FOUND: 'Audit history not found',
  AUDIT_HISTORY_DELETED: 'Audit history has been deleted',
  AUDIT_HISTORY_EXPIRED: 'Audit history has expired',
  AUDIT_HISTORY_STATE_EXPIRED: 'Audit history state has expired',
  AUDIT_HISTORY_INVALID_STATE: 'Audit history state is invalid',
  AUDIT_HISTORY_STATE_UNAVAILABLE: 'Audit history state is unavailable',
  AUDIT_HISTORY_GENERATION_CONFLICT: 'Audit history generation conflict',
  AUDIT_HISTORY_REVISION_CONFLICT: 'Audit history revision conflict',
  AUDIT_HISTORY_IDEMPOTENCY_CONFLICT: 'Audit history request conflict',
  AUDIT_HISTORY_ID_EXISTS: 'Audit history case already exists',
  AUDIT_HISTORY_UNTRUSTED: 'Imported audit history cannot continue',
  AUDIT_HISTORY_TURN_FENCE_INVALID: 'Audit history turn lease is no longer valid',
  AUDIT_TURN_BUSY: 'Audit turn is already in progress',
  AUDIT_SENSITIVE_INPUT: 'Sensitive input is not accepted',
  AUDIT_HISTORY_MODEL_FAILURE: 'Audit history processing is unavailable',
  AUDIT_HISTORY_TURN_LIMIT: 'Audit history turn limit reached',
  AUDIT_HISTORY_UNAVAILABLE: 'Audit history is unavailable',
  AUDIT_HISTORY_STORAGE_FAILURE: 'Audit history storage is unavailable',
  AUDIT_HISTORY_KEY_FAILURE: 'Audit history encryption is unavailable',
  AUDIT_HISTORY_CONFIG_INVALID: 'Audit history configuration unavailable',
  AUDIT_HISTORY_BODY_TOO_LARGE: 'Audit history request is too large',
  AUDIT_HISTORY_RATE_LIMITED: 'Audit history rate limit reached',
  AUDIT_HISTORY_RESPONSE_TOO_LARGE: 'Audit history response is too large',
  AUDIT_HISTORY_TIMEOUT: 'Audit history request timed out',
  AUDIT_HISTORY_CANCELLED: 'Audit history request was cancelled',
});

type AdmissionKind = 'read' | 'write';

type AdmissionEntry = {
  windowStartedAt: number;
  readCount: number;
  writeCount: number;
  readInFlight: number;
  writeInFlight: number;
};

export type AdmissionLease = Readonly<{ release(): void; retryAfter: number }>;

export type AuditHistoryAdmission = Readonly<{
  acquire(principal: HistoryPrincipal, kind: AdmissionKind): AdmissionLease | null;
}>;

export function createAuditHistoryAdmission(options: Readonly<{
  maxOwners?: number;
  maxReadsPerMinute?: number;
  maxWritesPerMinute?: number;
  maxReadConcurrency?: number;
  maxWriteConcurrency?: number;
  now?: () => number;
}> = {}): AuditHistoryAdmission {
  const entries = new Map<string, AdmissionEntry>();
  const maxOwners = options.maxOwners ?? MAX_OWNERS;
  const readLimit = options.maxReadsPerMinute ?? MAX_READS_PER_MINUTE;
  const writeLimit = options.maxWritesPerMinute ?? MAX_WRITES_PER_MINUTE;
  const readConcurrency = options.maxReadConcurrency ?? MAX_READ_CONCURRENCY;
  const writeConcurrency = options.maxWriteConcurrency ?? MAX_WRITE_CONCURRENCY;
  const now = options.now ?? Date.now;

  const prune = (timestamp: number): void => {
    for (const [key, entry] of entries) {
      if (entry.readInFlight === 0 && entry.writeInFlight === 0 && timestamp - entry.windowStartedAt >= 60_000) entries.delete(key);
    }
  };

  const acquire = (principal: HistoryPrincipal, kind: AdmissionKind): AdmissionLease | null => {
    const timestamp = now();
    if (!Number.isSafeInteger(timestamp)) return null;
    prune(timestamp);
    const key = `${principal.userId}\u0000${principal.accountId}`;
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= maxOwners) return null;
      entry = { windowStartedAt: timestamp, readCount: 0, writeCount: 0, readInFlight: 0, writeInFlight: 0 };
      entries.set(key, entry);
    }
    if (timestamp - entry.windowStartedAt >= 60_000) {
      entry.windowStartedAt = timestamp;
      entry.readCount = 0;
      entry.writeCount = 0;
    }
    const limit = kind === 'write' ? writeLimit : readLimit;
    const concurrency = kind === 'write' ? writeConcurrency : readConcurrency;
    const count = kind === 'write' ? entry.writeCount : entry.readCount;
    const inFlight = kind === 'write' ? entry.writeInFlight : entry.readInFlight;
    if (count >= limit || inFlight >= concurrency) return null;
    if (kind === 'write') {
      entry.writeCount += 1;
      entry.writeInFlight += 1;
    } else {
      entry.readCount += 1;
      entry.readInFlight += 1;
    }
    let released = false;
    return Object.freeze({
      retryAfter: Math.max(1, Math.ceil((60_000 - (timestamp - entry.windowStartedAt)) / 1_000)),
      release: () => {
        if (released) return;
        released = true;
        if (kind === 'write') entry!.writeInFlight = Math.max(0, entry!.writeInFlight - 1);
        else entry!.readInFlight = Math.max(0, entry!.readInFlight - 1);
        prune(now());
      },
    });
  };

  return Object.freeze({ acquire });
}

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(status: number, code: string, retryAfter?: number) {
    super(SAFE_MESSAGES[code] ?? 'Audit history is unavailable');
    this.name = 'AuditHistoryHttpError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

class BodyTooLargeError extends HttpError {
  constructor() { super(413, 'AUDIT_HISTORY_BODY_TOO_LARGE'); }
}

class BodyTimeoutError extends HttpError {
  constructor() { super(504, 'AUDIT_HISTORY_TIMEOUT'); }
}

class BodyAbortedError extends HttpError {
  constructor() { super(504, 'AUDIT_HISTORY_CANCELLED'); }
}

function errorResponse(error: unknown): Response {
  const status = error instanceof HttpError || error instanceof AuditHistoryValidationError || error instanceof AuditHistoryServiceError || error instanceof HistoryError
    ? error.status
    : 503;
  const code = error instanceof HttpError || error instanceof AuditHistoryValidationError || error instanceof AuditHistoryServiceError || error instanceof HistoryError
    ? error.code
    : 'AUDIT_HISTORY_UNAVAILABLE';
  const body = JSON.stringify({ error: SAFE_MESSAGES[code] ?? 'Audit history is unavailable', code });
  const retryAfter = error instanceof HttpError ? error.retryAfter : undefined;
  return new Response(body, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(retryAfter === undefined ? {} : { 'retry-after': String(retryAfter) }) },
  });
}

function successResponse(value: unknown): Response {
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return errorResponse(new HttpError(503, 'AUDIT_HISTORY_UNAVAILABLE')); }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_RESPONSE_BYTES) return errorResponse(new HttpError(503, 'AUDIT_HISTORY_RESPONSE_TOO_LARGE'));
  return new Response(serialized, {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function pathError(): never {
  throw new HttpError(404, 'AUDIT_HISTORY_NOT_FOUND');
}

function methodError(): never {
  throw new HttpError(405, 'AUDIT_HISTORY_INVALID_INPUT');
}

type ResolvedOperation = Readonly<{
  kind: HistoryOperation;
  method: string;
  resourceId?: string;
  scope: AuditHistoryScope;
}>;

function resolveOperation(method: string, rawSegments: readonly string[]): ResolvedOperation {
  let segments: readonly string[];
  try {
    segments = validatePathSegments(rawSegments);
  } catch {
    pathError();
  }
  if (segments.length === 0) {
    if (method === 'GET') return { kind: 'list', method, scope: 'audit:read' };
    if (method === 'POST') return { kind: 'create', method, scope: 'audit:write' };
    if (method === 'DELETE') return { kind: 'clear', method, scope: 'audit:write' };
    methodError();
  }
  if (segments.length === 1 && segments[0] === 'import') {
    if (method !== 'POST') methodError();
    return { kind: 'import', method, scope: 'audit:write' };
  }
  const resourceId = segments[0]!;
  if (segments.length === 1) {
    if (method === 'GET') return { kind: 'read', method, resourceId, scope: 'audit:read' };
    if (method === 'PATCH') return { kind: 'update', method, resourceId, scope: 'audit:write' };
    if (method === 'DELETE') return { kind: 'remove', method, resourceId, scope: 'audit:write' };
    methodError();
  }
  if (segments.length === 2 && segments[1] === 'turn') {
    if (method !== 'POST') methodError();
    return { kind: 'turn', method, resourceId, scope: 'audit:write' };
  }
  pathError();
}

function queryCursor(request: Request, operation: ResolvedOperation): string | undefined {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  }
  const entries = [...url.searchParams.entries()];
  if (operation.kind === 'list') {
    if (entries.some(([key]) => key !== 'cursor') || entries.length > 1) throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
    return validateCursor(entries[0]?.[1]);
  }
  if (entries.length > 0) throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  return undefined;
}

function jsonContentType(request: Request): boolean {
  const value = request.headers.get('content-type');
  return typeof value === 'string' && /^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?$/iu.test(value.trim());
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  try { await reader.cancel(); } catch { /* safe cleanup */ }
}

export async function readAuditHistoryJsonBody(request: Request, maxBytes = HISTORY_LIMITS.maxBodyBytes): Promise<unknown> {
  if (!jsonContentType(request)) throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/u.test(contentLength)) throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
    if (Number(contentLength) > maxBytes) throw new BodyTooLargeError();
  }
  if (!request.body) throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timedOut = false;
  let aborted = request.signal.aborted;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rejectAbort: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new BodyAbortedError());
  });
  const onAbort = (): void => {
    aborted = true;
    rejectAbort?.();
    void cancelReader(reader);
  };
  const readPromise = (async (): Promise<Uint8Array> => {
    while (true) {
      const result = await reader.read();
      if (timedOut) throw new BodyTimeoutError();
      if (aborted) throw new BodyAbortedError();
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) {
        void cancelReader(reader);
        throw new BodyTooLargeError();
      }
      chunks.push(result.value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  })();
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      reject(new BodyTimeoutError());
      void cancelReader(reader);
    }, BODY_TIMEOUT_MS);
  });
  request.signal.addEventListener('abort', onAbort, { once: true });
  try {
    if (aborted) throw new BodyAbortedError();
    const bytes = await Promise.race([readPromise, timeoutPromise, abortPromise]);
    if (timedOut) throw new BodyTimeoutError();
    if (aborted) throw new BodyAbortedError();
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT'); }
    try { return JSON.parse(text) as unknown; } catch { throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT'); }
  } catch (error) {
    if (timedOut) throw new BodyTimeoutError();
    if (error instanceof BodyTooLargeError || error instanceof BodyTimeoutError || error instanceof BodyAbortedError || error instanceof HttpError) throw error;
    throw new HttpError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    request.signal.removeEventListener('abort', onAbort);
    if (request.signal.aborted) void cancelReader(reader);
  }
}

function ownerAdmissionKey(principal: HistoryPrincipal): HistoryPrincipal {
  return Object.freeze({ userId: principal.userId, accountId: principal.accountId });
}

export type AuditHistoryHandlerDeps = Readonly<{
  store: HistoryStore;
  auth?: Readonly<{ verify(authorization: string | null, requiredScope: AuditHistoryScope): Promise<HistoryPrincipal> }>;
  verifier?: Readonly<{ verify(authorization: string | null, requiredScope: AuditHistoryScope): Promise<HistoryPrincipal> }>;
  extractor?: AuditHistoryExtractor;
  extract?: AuditHistoryExtractor;
  service?: AuditHistoryService;
  admission?: AuditHistoryAdmission;
}>;

export function createAuditHistoryHandler(deps: AuditHistoryHandlerDeps): (request: Request, segments?: readonly string[]) => Promise<Response> {
  const service = deps.service ?? createAuditHistoryService({ store: deps.store, extractor: deps.extractor ?? deps.extract });
  const admission = deps.admission ?? createAuditHistoryAdmission();
  const auth = deps.auth ?? deps.verifier;
  if (!auth) throw new Error('Audit history verifier is required');

  return async (request: Request, segments: readonly string[] = []): Promise<Response> => {
    let operation: ResolvedOperation;
    try {
      operation = resolveOperation(request.method.toUpperCase(), segments);
      if (request.signal.aborted) throw new BodyAbortedError();
      let principal: HistoryPrincipal;
      try {
        principal = await auth.verify(authorizationFromRequest(request), operation.scope);
      } catch (error) {
        if (error instanceof HistoryError || error instanceof AuditHistoryServiceError || error instanceof HttpError) throw error;
        throw new HttpError(503, 'AUDIT_HISTORY_UNAVAILABLE');
      }
      const cursor = queryCursor(request, operation);
      const lease = admission.acquire(ownerAdmissionKey(principal), operation.scope === 'audit:write' ? 'write' : 'read');
      if (!lease) throw new HttpError(429, 'AUDIT_HISTORY_RATE_LIMITED', 1);
      try {
        if (operation.kind === 'list') return successResponse(service.list(principal, cursor));
        if (operation.kind === 'read') return successResponse(service.get(principal, operation.resourceId!));
        const body = await readAuditHistoryJsonBody(request);
        const validated = validateOperationBody(operation.kind as Exclude<HistoryOperation, 'list' | 'read'>, body);
        if (operation.kind === 'create') return successResponse(service.create(principal, validated as never));
        if (operation.kind === 'update') return successResponse(service.update(principal, operation.resourceId!, validated as never));
        if (operation.kind === 'remove') return successResponse(service.remove(principal, operation.resourceId!, validated as never));
        if (operation.kind === 'clear') return successResponse(service.clear(principal, validated as never));
        if (operation.kind === 'import') return successResponse(service.importArchive(principal, validated as never));
        return successResponse(await service.turn(principal, operation.resourceId!, validated as never));
      } finally {
        lease.release();
      }
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export const handleAuditHistoryRequest = createAuditHistoryHandler;
