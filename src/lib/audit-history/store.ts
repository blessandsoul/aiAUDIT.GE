import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { chmodSync, lstatSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { decryptPayload, encryptPayload, makeAssociatedData } from './crypto.ts';
import {
  type Assessment,
  type AuditLanguage,
  type AuditMode,
  type AuditRecord,
  type CommitTurnInput,
  type CreateHistoryInput,
  HistoryError,
  type HistoryEnvelope,
  type HistoryListResult,
  type HistoryMutationResult,
  type HistoryPrincipal,
  type HistoryReceipt,
  type HistoryStoreOptions,
  type ImportHistoryInput,
  type IntakeState,
  type Message,
  type Pilot,
  type ReleaseTurnInput,
  type ReportRevision,
  type ReserveTurnInput,
  type ReserveTurnResult,
  type UpdateHistoryInput,
} from './types.ts';

const SCHEMA_VERSION = 1;
const MAX_ID_LENGTH = 200;
const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_COUNT = 200;
const MAX_MESSAGE_LENGTH = 20_000;
const MAX_SUGGESTIONS = 12;
const MAX_SUGGESTION_LENGTH = 500;
const MAX_FACT_COUNT = 120;
const MAX_HISTORY_COUNT = 160;
const MAX_REPORT_LENGTH = 20_000;
const MAX_PILOT_FIELD_LENGTH = 4_000;
const MAX_PROOF_LENGTH = 512;
const MAX_RECORD_BYTES = 512 * 1024;
const MAX_IMPORT_BYTES = 256 * 1024;
const MAX_OWNER_BYTES = 16 * 1024 * 1024;
const MAX_LIVE_RECORDS = 50;
const MAX_REQUESTS = 4_096;
const MAX_TOMBSTONES = 256;
const MAX_CLEAR_RECEIPTS = 64;
const MAX_REPORT_REVISIONS = 50;
const TURN_LEASE_MS = 90_000;

type SqlDatabase = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
  close(): void;
};

type SqlRow = Record<string, unknown>;

type RequestRow = SqlRow & {
  operation: string;
  resource_id: string;
  body_fingerprint: string;
  result_fingerprint: string | null;
  result_id: string | null;
  result_generation: number;
  result_revision: number | null;
};

type RecordRow = SqlRow & {
  generation: number;
  id: string;
  revision: number;
  trust: 'provider' | 'imported_unverified';
  key_id: string | null;
  nonce: Uint8Array | null;
  ciphertext: Uint8Array | null;
  tag: Uint8Array | null;
  payload_size: number;
  updated_ms: number;
  deleted: number;
};

type LeaseRow = SqlRow & {
  generation: number;
  id: string;
  request_hash: string;
  fingerprint: string;
  revision: number;
  fence: string;
  expires_ms: number;
};

type TurnIntentRow = SqlRow & {
  generation: number;
  id: string;
  request_hash: string;
  expected_revision: number;
  fingerprint: string;
  state: 'pending' | 'released' | 'completed';
  last_fence: string;
  result_fingerprint: string | null;
  result_id: string | null;
  result_generation: number | null;
  result_revision: number | null;
};

const RECORD_KEYS = new Set([
  'id',
  'title',
  'mode',
  'language',
  'createdAt',
  'updatedAt',
  'messages',
  'intakeState',
  'assessment',
  'report',
  'decision',
  'pilot',
]);

function invalid(): never {
  throw new HistoryError(400, 'AUDIT_HISTORY_INVALID_INPUT');
}

function conflict(code: string): never {
  throw new HistoryError(409, code);
}

function capacity(status = 503): never {
  throw new HistoryError(status, 'AUDIT_HISTORY_CAPACITY');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function exactKeys(value: object, allowed: ReadonlySet<string>): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid();
  }
}

function safeText(value: unknown, max: number, allowEmpty = true): asserts value is string {
  // Newlines, tabs, and carriage returns are valid transcript/report text;
  // reject the remaining C0 controls and DEL so opaque values cannot smuggle
  // terminal or SQL-log control bytes.
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && value.length === 0) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) invalid();
}

function safeOpaque(value: unknown, max = MAX_ID_LENGTH): asserts value is string {
  safeText(value, max, false);
  if (/[\u0000-\u001f\u007f]/u.test(value)) invalid();
}

function safeInteger(value: unknown, minimum = 1): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) invalid();
}

function assertPrincipal(principal: HistoryPrincipal): void {
  if (!isPlainObject(principal)) invalid();
  exactKeys(principal, new Set(['userId', 'accountId']));
  safeOpaque(principal.userId);
  safeOpaque(principal.accountId);
}

function assertRequestId(requestId: unknown): asserts requestId is string {
  safeOpaque(requestId);
}

function assertMode(value: unknown): asserts value is AuditMode {
  if (value !== 'quick' && value !== 'deep') invalid();
}

function assertLanguage(value: unknown): asserts value is AuditLanguage {
  if (value !== 'ka' && value !== 'ru' && value !== 'en') invalid();
}

function assertDateText(value: unknown): asserts value is string {
  safeText(value, 64, false);
  if (!Number.isFinite(Date.parse(value))) invalid();
}

function stableStringify(value: unknown): string {
  const seen = new Set<unknown>();
  const encode = (item: unknown, depth: number): string => {
    if (depth > 8) invalid();
    if (item === undefined) return 'undefined';
    if (item === null) return 'null';
    if (typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) invalid();
      return JSON.stringify(item);
    }
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item !== 'object') invalid();
    if (seen.has(item)) invalid();
    seen.add(item);
    let result: string;
    if (Array.isArray(item)) {
      result = `[${item.map((child) => encode(child, depth + 1)).join(',')}]`;
    } else {
      const object = item as Record<string, unknown>;
      const keys = Object.keys(object).sort();
      result = `{${keys.map((key) => `${JSON.stringify(key)}:${encode(object[key], depth + 1)}`).join(',')}}`;
    }
    seen.delete(item);
    return result;
  };
  return encode(value, 0);
}

function hashValue(value: unknown): string {
  return createHash('sha256').update(stableStringify(value), 'utf8').digest('base64url');
}

function jsonBytes(value: unknown): Buffer {
  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    invalid();
  }
  if (typeof serialized !== 'string') invalid();
  return Buffer.from(serialized, 'utf8');
}

function requestHash(requestId: string): string {
  return createHash('sha256').update(requestId, 'utf8').digest('base64url');
}

function nowIso(now: number): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000) {
    throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  }
  return new Date(now).toISOString();
}

function asBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Buffer.isBuffer(value)) return Uint8Array.from(value);
  throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
}

function asRow(value: unknown): SqlRow {
  if (!isPlainObject(value)) throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  return value;
}

function asNumber(value: unknown): number {
  if (typeof value === 'bigint') {
    const result = Number(value);
    if (!Number.isSafeInteger(result)) throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
    return result;
  }
  if (!Number.isSafeInteger(value)) throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  return value as number;
}

function asString(value: unknown): string {
  if (typeof value !== 'string') throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  return value;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateJsonValue(value: unknown, depth = 0): void {
  if (depth > 6) invalid();
  // JSON.stringify omits undefined object properties; preserve that ordinary
  // persistence behavior for optional engine/provider fields.
  if (value === undefined) return;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    if (typeof value === 'string') safeText(value, MAX_MESSAGE_LENGTH);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid();
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) invalid();
    for (const child of value) validateJsonValue(child, depth + 1);
    return;
  }
  if (!isPlainObject(value)) invalid();
  const keys = Object.keys(value);
  if (keys.length > 200) invalid();
  for (const key of keys) {
    safeOpaque(key);
    validateJsonValue(value[key], depth + 1);
  }
}

function assertIntakeState(value: unknown): asserts value is IntakeState | null {
  if (value === null) return;
  if (!isPlainObject(value)) invalid();
  validateJsonValue(value);
  if (typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1 || value.version > 100) invalid();
  if (typeof value.turn !== 'number' || !Number.isSafeInteger(value.turn) || value.turn < 0 || value.turn > 1000) invalid();
  assertLanguage(value.language);
  if (value.mode !== undefined) assertMode(value.mode);
  safeText(value.focus, MAX_TITLE_LENGTH);
  if (!isPlainObject(value.facts) || Object.keys(value.facts).length > MAX_FACT_COUNT) invalid();
  if (value.currentQuestion !== null) safeText(value.currentQuestion, MAX_TITLE_LENGTH);
  if (typeof value.complete !== 'boolean') invalid();
  if (value.proof !== undefined && value.proof !== null) safeText(value.proof, MAX_PROOF_LENGTH);
  if (!Array.isArray(value.history) || value.history.length > MAX_HISTORY_COUNT) invalid();
  for (const item of value.history) {
    if (!isPlainObject(item)) invalid();
    if (item.role !== 'user' && item.role !== 'assistant') invalid();
    safeText(item.content, MAX_MESSAGE_LENGTH);
  }
  if (!isPlainObject(value.asked) || Object.keys(value.asked).length > MAX_FACT_COUNT) invalid();
  for (const count of Object.values(value.asked)) {
    safeInteger(count, 0);
    if (count > 1000) invalid();
  }
}

function assertAssessment(value: unknown): asserts value is Assessment | null {
  if (value === null) return;
  if (!isPlainObject(value)) invalid();
  exactKeys(value, new Set(['verdict', 'product', 'opportunity', 'readiness', 'evidence']));
  safeText(value.verdict, MAX_TITLE_LENGTH, false);
  if (value.product !== null) safeText(value.product, MAX_TITLE_LENGTH);
  safeText(value.opportunity, MAX_TITLE_LENGTH, false);
  safeText(value.readiness, MAX_TITLE_LENGTH, false);
  if (!Array.isArray(value.evidence) || value.evidence.length > MAX_FACT_COUNT) invalid();
  for (const item of value.evidence) safeText(item, MAX_MESSAGE_LENGTH, false);
}

function assertPilot(value: unknown): asserts value is Pilot | null {
  if (value === null) return;
  if (!isPlainObject(value)) invalid();
  exactKeys(value, new Set(['owner', 'metric', 'baseline', 'target', 'observed', 'stopRule', 'status']));
  for (const key of ['owner', 'metric', 'baseline', 'target', 'observed', 'stopRule']) safeText(value[key], MAX_PILOT_FIELD_LENGTH);
  if (value.status !== 'draft' && value.status !== 'measuring' && value.status !== 'review' && value.status !== 'completed') invalid();
}

function assertMessage(value: unknown): asserts value is Message {
  if (!isPlainObject(value)) invalid();
  exactKeys(value, new Set(['id', 'role', 'content', 'suggestions']));
  safeOpaque(value.id);
  if (value.role !== 'user' && value.role !== 'assistant') invalid();
  safeText(value.content, MAX_MESSAGE_LENGTH);
  if (value.suggestions !== undefined) {
    if (!Array.isArray(value.suggestions) || value.suggestions.length > MAX_SUGGESTIONS) invalid();
    for (const suggestion of value.suggestions) safeText(suggestion, MAX_SUGGESTION_LENGTH);
  }
}

function assertRecord(value: unknown): asserts value is AuditRecord {
  if (!isPlainObject(value)) invalid();
  exactKeys(value, RECORD_KEYS);
  safeOpaque(value.id);
  safeText(value.title, MAX_TITLE_LENGTH);
  assertMode(value.mode);
  assertLanguage(value.language);
  assertDateText(value.createdAt);
  assertDateText(value.updatedAt);
  if (!Array.isArray(value.messages) || value.messages.length > MAX_MESSAGE_COUNT) invalid();
  for (const message of value.messages) assertMessage(message);
  assertIntakeState(value.intakeState);
  assertAssessment(value.assessment);
  if (value.report !== null) safeText(value.report, MAX_REPORT_LENGTH);
  if (value.decision !== 'unreviewed' && value.decision !== 'prepare' && value.decision !== 'defer') invalid();
  assertPilot(value.pilot);
  // Force JSON serializability and bound nested engine maps before encryption.
  stableStringify(value);
}

function assertReportRevisions(value: unknown): asserts value is ReportRevision[] {
  if (!Array.isArray(value) || value.length > MAX_REPORT_REVISIONS) invalid();
  for (const revision of value) {
    if (!isPlainObject(revision)) invalid();
    exactKeys(revision, new Set(['revision', 'createdAt', 'report', 'assessment']));
    safeInteger(revision.revision);
    assertDateText(revision.createdAt);
    safeText(revision.report, MAX_REPORT_LENGTH);
    assertAssessment(revision.assessment);
  }
}

function assertEnvelopePayload(value: unknown): asserts value is { record: AuditRecord; reportRevisions: ReportRevision[] } {
  if (!isPlainObject(value)) invalid();
  exactKeys(value, new Set(['record', 'reportRevisions']));
  assertRecord(value.record);
  assertReportRevisions(value.reportRevisions);
}

function validateKeyring(keyring: HistoryStoreOptions['keyring']): Map<string, Uint8Array> {
  if (!isPlainObject(keyring)) invalid();
  exactKeys(keyring, new Set(['activeKeyId', 'keys']));
  safeOpaque(keyring.activeKeyId, 64);
  if (!(keyring.keys instanceof Map) || keyring.keys.size === 0 || keyring.keys.size > 4 || !keyring.keys.has(keyring.activeKeyId)) invalid();
  const result = new Map<string, Uint8Array>();
  for (const [id, key] of keyring.keys.entries()) {
    safeOpaque(id, 64);
    if (!(key instanceof Uint8Array) || key.byteLength !== 32) invalid();
    result.set(id, Uint8Array.from(key));
  }
  return result;
}

function validateRetention(retention: HistoryStoreOptions['retention']): void {
  if (retention === 'owner_delete') return;
  if (!isPlainObject(retention) || (retention.days !== 90 && retention.days !== 365)) invalid();
}

function validateStoragePath(input: string): string {
  if (typeof input !== 'string' || !isAbsolute(input) || input.includes('\u0000')) invalid();
  const filePath = resolve(input);
  const parent = dirname(filePath);
  const parentRoot = parse(parent).root;
  let current = parentRoot;
  try {
    for (const component of parent.slice(parentRoot.length).split(/[\\/]+/u).filter(Boolean)) {
      current = join(current, component);
      const info = lstatSync(current);
      if (info.isSymbolicLink() || !info.isDirectory()) invalid();
    }
    try {
      const info = lstatSync(filePath);
      // lstat, unlike existsSync, observes dangling symlinks.
      if (info.isSymbolicLink() || !info.isFile()) invalid();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') invalid();
    }
  } catch (error) {
    if (error instanceof HistoryError) throw error;
    throw new HistoryError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  }
  return filePath;
}

function enforceStoragePermissions(filePath: string): void {
  // Windows ACLs are managed outside chmod; do not claim POSIX mode-bit
  // enforcement there. On POSIX, inability to apply restrictive modes is a
  // storage failure, never a warning that permits opening the database.
  if (process.platform === 'win32') return;
  try {
    chmodSync(dirname(filePath), 0o700);
    try {
      lstatSync(filePath);
      chmodSync(filePath, 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  } catch {
    throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  }
}

function schema(): string {
  return `
    CREATE TABLE IF NOT EXISTS audit_owner_state (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      PRIMARY KEY (user_id, account_id)
    );
    CREATE TABLE IF NOT EXISTS audit_records (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      id TEXT NOT NULL,
      revision INTEGER NOT NULL,
      trust TEXT NOT NULL CHECK (trust IN ('provider', 'imported_unverified')),
      key_id TEXT,
      nonce BLOB,
      ciphertext BLOB,
      tag BLOB,
      payload_size INTEGER NOT NULL DEFAULT 0,
      updated_ms INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, account_id, generation, id)
    );
    CREATE INDEX IF NOT EXISTS audit_records_list_idx
      ON audit_records (user_id, account_id, generation, deleted, updated_ms DESC, id DESC);
    CREATE TABLE IF NOT EXISTS audit_requests (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      request_hash TEXT NOT NULL,
      operation TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      body_fingerprint TEXT NOT NULL,
      result_fingerprint TEXT,
      result_id TEXT,
      result_generation INTEGER NOT NULL,
      result_revision INTEGER,
      PRIMARY KEY (user_id, account_id, generation, request_hash, operation, resource_id)
    );
    CREATE INDEX IF NOT EXISTS audit_requests_hash_idx
      ON audit_requests (user_id, account_id, generation, request_hash);
    CREATE TABLE IF NOT EXISTS audit_clear_receipts (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      old_generation INTEGER NOT NULL,
      request_hash TEXT NOT NULL,
      body_fingerprint TEXT NOT NULL,
      new_generation INTEGER NOT NULL,
      PRIMARY KEY (user_id, account_id, old_generation, request_hash)
    );
    CREATE TABLE IF NOT EXISTS audit_turn_leases (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      revision INTEGER NOT NULL,
      fence TEXT NOT NULL,
      expires_ms INTEGER NOT NULL,
      PRIMARY KEY (user_id, account_id, generation, id)
    );
    CREATE TABLE IF NOT EXISTS audit_turn_intents (
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      id TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      expected_revision INTEGER NOT NULL,
      fingerprint TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('pending', 'released', 'completed')),
      last_fence TEXT NOT NULL,
      result_fingerprint TEXT,
      result_id TEXT,
      result_generation INTEGER,
      result_revision INTEGER,
      PRIMARY KEY (user_id, account_id, generation, id, request_hash)
    );
    CREATE INDEX IF NOT EXISTS audit_turn_intents_request_idx
      ON audit_turn_intents (user_id, account_id, generation, request_hash);
  `;
}

function rowNumber(row: SqlRow, key: string): number {
  return asNumber(row[key]);
}

function rowString(row: SqlRow, key: string): string {
  return asString(row[key]);
}

export class HistoryStore {
  private readonly dbPath: string;
  private readonly keys: Map<string, Uint8Array>;
  private readonly activeKeyId: string;
  private readonly retention: HistoryStoreOptions['retention'];
  private readonly nowFn: () => number;
  private db: SqlDatabase | null;

  constructor(options: HistoryStoreOptions) {
    this.dbPath = validateStoragePath(options.path);
    validateRetention(options.retention);
    this.keys = validateKeyring(options.keyring);
    this.activeKeyId = options.keyring.activeKeyId;
    this.retention = options.retention;
    this.nowFn = options.now ?? Date.now;
    let database: SqlDatabase | null = null;
    try {
      enforceStoragePermissions(this.dbPath);
      database = new DatabaseSync(this.dbPath) as unknown as SqlDatabase;
      database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;');
      database.exec(schema());
      enforceStoragePermissions(this.dbPath);
      this.db = database;
    } catch {
      try {
        database?.close();
      } catch {
        // Preserve the fixed public error below.
      }
      throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
    }
  }

  get closed(): boolean {
    return this.db === null;
  }

  close(): void {
    if (this.db === null) return;
    try {
      this.db.close();
    } catch {
      throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
    } finally {
      this.db = null;
    }
  }

  private database(): SqlDatabase {
    if (this.db === null) throw new HistoryError(503, 'AUDIT_HISTORY_UNAVAILABLE');
    return this.db;
  }

  private now(): number {
    const value = this.nowFn();
    if (!Number.isSafeInteger(value) || value < 0) throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
    return value;
  }

  private retentionCutoff(now: number): number | null {
    return this.retention === 'owner_delete' ? null : now - this.retention.days * 24 * 60 * 60 * 1000;
  }

  private ensureNotExpired(row: RecordRow, now = this.now()): void {
    if (this.isExpired(row, now)) {
      throw new HistoryError(410, 'AUDIT_HISTORY_EXPIRED');
    }
  }

  private isExpired(row: RecordRow, now = this.now()): boolean {
    const cutoff = this.retentionCutoff(now);
    return cutoff !== null && rowNumber(row, 'updated_ms') <= cutoff;
  }

  private transaction<T>(callback: (db: SqlDatabase) => T): T {
    const db = this.database();
    try {
      db.exec('BEGIN IMMEDIATE');
      const value = callback(db);
      db.exec('COMMIT');
      return value;
    } catch (error) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Preserve the original fixed error.
      }
      if (error instanceof HistoryError) throw error;
      throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
    }
  }

  private ensureOwner(db: SqlDatabase, principal: HistoryPrincipal): number {
    db.prepare('INSERT OR IGNORE INTO audit_owner_state (user_id, account_id, generation) VALUES (?, ?, 1)').run(principal.userId, principal.accountId);
    const row = asRow(db.prepare('SELECT generation FROM audit_owner_state WHERE user_id = ? AND account_id = ?').get(principal.userId, principal.accountId));
    return rowNumber(row, 'generation');
  }

  private getRecordRow(db: SqlDatabase, principal: HistoryPrincipal, generation: number, id: string): RecordRow | null {
    const value = db.prepare(
      'SELECT generation,id,revision,trust,key_id,nonce,ciphertext,tag,payload_size,updated_ms,deleted FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?',
    ).get(principal.userId, principal.accountId, generation, id);
    return value === undefined ? null : asRow(value) as RecordRow;
  }

  private ensureLive(row: RecordRow | null): asserts row is RecordRow {
    if (row === null) throw new HistoryError(404, 'AUDIT_HISTORY_NOT_FOUND');
    if (rowNumber(row, 'deleted') !== 0) throw new HistoryError(410, 'AUDIT_HISTORY_DELETED');
  }

  private readEnvelope(principal: HistoryPrincipal, row: RecordRow): HistoryEnvelope {
    if (row.key_id === null || row.nonce === null || row.ciphertext === null || row.tag === null) {
      throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
    }
    const key = this.keys.get(rowString(row, 'key_id'));
    if (key === undefined) throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
    const decrypted = decryptPayload(
      {
        nonce: asBytes(row.nonce),
        ciphertext: asBytes(row.ciphertext),
        tag: asBytes(row.tag),
      },
      key,
      makeAssociatedData({
        userId: principal.userId,
        accountId: principal.accountId,
        id: rowString(row, 'id'),
        revision: rowNumber(row, 'revision'),
        schemaVersion: SCHEMA_VERSION,
      }),
    );
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(decrypted).toString('utf8'));
    } catch {
      throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
    }
    try {
      assertEnvelopePayload(parsed);
    } catch (error) {
      if (error instanceof HistoryError && error.code === 'AUDIT_HISTORY_INVALID_INPUT') {
        throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
      }
      throw error;
    }
    const record = parsed.record;
    if (record.id !== rowString(row, 'id')) throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
    return {
      schemaVersion: SCHEMA_VERSION,
      revision: rowNumber(row, 'revision'),
      generation: rowNumber(row, 'generation'),
      trust: row.trust,
      record: cloneJson(record),
      reportRevisions: cloneJson(parsed.reportRevisions),
    };
  }

  private payloadBytes(envelope: HistoryEnvelope): Buffer {
    // Persistence must use ordinary JSON semantics: preserve insertion order
    // for signed intake proofs and omit undefined optional fields. Canonical
    // sorting belongs only to request fingerprints, never encrypted payloads.
    const payload = jsonBytes({ record: envelope.record, reportRevisions: envelope.reportRevisions });
    if (payload.byteLength > MAX_RECORD_BYTES) capacity(413);
    return payload;
  }

  private writeEnvelope(db: SqlDatabase, principal: HistoryPrincipal, envelope: HistoryEnvelope, existingPayloadSize: number): number {
    const plaintext = this.payloadBytes(envelope);
    const key = this.keys.get(this.activeKeyId);
    if (key === undefined) throw new HistoryError(503, 'AUDIT_HISTORY_KEY_FAILURE');
    const encrypted = encryptPayload(
      plaintext,
      key,
      makeAssociatedData({
        userId: principal.userId,
        accountId: principal.accountId,
        id: envelope.record.id,
        revision: envelope.revision,
        schemaVersion: SCHEMA_VERSION,
      }),
    );
    const payloadSize = encrypted.ciphertext.byteLength;
    if (payloadSize + encrypted.nonce.byteLength + encrypted.tag.byteLength > MAX_RECORD_BYTES) capacity(413);
    const ownerBytes = asNumber(asRow(db.prepare(
      'SELECT COALESCE(SUM(payload_size), 0) AS total FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0',
    ).get(principal.userId, principal.accountId, envelope.generation)).total);
    if (ownerBytes - existingPayloadSize + payloadSize > MAX_OWNER_BYTES) capacity();
    db.prepare(
      'INSERT INTO audit_records (user_id,account_id,generation,id,revision,trust,key_id,nonce,ciphertext,tag,payload_size,updated_ms,deleted) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0) ON CONFLICT(user_id,account_id,generation,id) DO UPDATE SET revision=excluded.revision,trust=excluded.trust,key_id=excluded.key_id,nonce=excluded.nonce,ciphertext=excluded.ciphertext,tag=excluded.tag,payload_size=excluded.payload_size,updated_ms=excluded.updated_ms,deleted=0',
    ).run(
      principal.userId,
      principal.accountId,
      envelope.generation,
      envelope.record.id,
      envelope.revision,
      envelope.trust,
      this.activeKeyId,
      Buffer.from(encrypted.nonce),
      Buffer.from(encrypted.ciphertext),
      Buffer.from(encrypted.tag),
      payloadSize,
      Date.parse(envelope.record.updatedAt),
    );
    return payloadSize;
  }

  private requestRows(db: SqlDatabase, principal: HistoryPrincipal, generation: number, requestId: string): RequestRow[] {
    return db.prepare(
      'SELECT operation,resource_id,body_fingerprint,result_fingerprint,result_id,result_generation,result_revision FROM audit_requests WHERE user_id = ? AND account_id = ? AND generation = ? AND request_hash = ?',
    ).all(principal.userId, principal.accountId, generation, requestHash(requestId)).map(asRow) as RequestRow[];
  }

  private intentRows(db: SqlDatabase, principal: HistoryPrincipal, generation: number, requestId: string): TurnIntentRow[] {
    return db.prepare(
      'SELECT generation,id,request_hash,expected_revision,fingerprint,state,last_fence,result_fingerprint,result_id,result_generation,result_revision FROM audit_turn_intents WHERE user_id = ? AND account_id = ? AND generation = ? AND request_hash = ?',
    ).all(principal.userId, principal.accountId, generation, requestHash(requestId)).map(asRow) as TurnIntentRow[];
  }

  /** Ordinary operations may never reuse a request ID reserved by a turn. */
  private assertOrdinaryRequestNamespaceFree(db: SqlDatabase, principal: HistoryPrincipal, generation: number, requestId: string): void {
    if (this.intentRows(db, principal, generation, requestId).length > 0) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
  }

  /**
   * Turn admission may replay an old legacy turn row for the exact resource,
   * but a request bound to any other operation/resource is a namespace clash.
   */
  private turnRequestNamespaceRow(db: SqlDatabase, principal: HistoryPrincipal, generation: number, requestId: string, id: string): RequestRow | null {
    const intents = this.intentRows(db, principal, generation, requestId);
    if (intents.length > 0) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
    const requests = this.requestRows(db, principal, generation, requestId);
    if (requests.length === 0) return null;
    const exactLegacyTurn = requests.find((row) => row.operation === 'turn' && row.resource_id === id);
    if (exactLegacyTurn === undefined) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
    return exactLegacyTurn;
  }

  /** A turn lifecycle cannot coexist with an ordinary request binding. */
  private assertTurnNamespaceFreeOfOrdinaryRequest(db: SqlDatabase, principal: HistoryPrincipal, generation: number, requestId: string): void {
    if (this.requestRows(db, principal, generation, requestId).length > 0) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
  }

  private assertNoChangedRequestBody(db: SqlDatabase, principal: HistoryPrincipal, generation: number, requestId: string, operation: string, resourceId: string, bodyFingerprint: string, resultFingerprint?: string): RequestRow | null {
    const hash = requestHash(requestId);
    const rows = db.prepare(
      'SELECT operation,resource_id,body_fingerprint,result_fingerprint,result_id,result_generation,result_revision FROM audit_requests WHERE user_id = ? AND account_id = ? AND generation = ? AND request_hash = ?',
    ).all(principal.userId, principal.accountId, generation, hash).map(asRow) as RequestRow[];
    if (rows.length === 0) return null;
    const row = rows.find((candidate) => candidate.operation === operation && candidate.resource_id === resourceId);
    if (row === undefined) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
    if ((bodyFingerprint !== '' && row.body_fingerprint !== bodyFingerprint) || (resultFingerprint !== undefined && row.result_fingerprint !== resultFingerprint)) {
      conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
    }
    return row;
  }

  private saveRequest(
    db: SqlDatabase,
    principal: HistoryPrincipal,
    generation: number,
    requestId: string,
    operation: string,
    resourceId: string,
    bodyFingerprint: string,
    resultFingerprint: string | null,
    resultId: string | null,
    resultGeneration: number,
    resultRevision: number | null,
  ): void {
    this.ensureMetadataCapacity(db, principal, generation);
    db.prepare(
      'INSERT INTO audit_requests (user_id,account_id,generation,request_hash,operation,resource_id,body_fingerprint,result_fingerprint,result_id,result_generation,result_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    ).run(
      principal.userId,
      principal.accountId,
      generation,
      requestHash(requestId),
      operation,
      resourceId,
      bodyFingerprint,
      resultFingerprint,
      resultId,
      resultGeneration,
      resultRevision,
    );
  }

  private receipt(requestId: string, operation: string, id: string | null, generation: number, committedRevision: number | null): HistoryReceipt {
    return { requestId, operation, id, generation, committedRevision };
  }

  private replayResult(db: SqlDatabase, principal: HistoryPrincipal, requestId: string, row: RequestRow): HistoryMutationResult {
    const resultId = row.result_id;
    let envelope: HistoryEnvelope | null = null;
    if (resultId !== null) {
      const currentGeneration = this.ensureOwner(db, principal);
      if (currentGeneration === rowNumber(row, 'result_generation')) {
        const currentRow = this.getRecordRow(db, principal, currentGeneration, resultId);
        if (currentRow !== null && rowNumber(currentRow, 'deleted') === 0 && !this.isExpired(currentRow)) envelope = this.readEnvelope(principal, currentRow);
      }
    }
    return {
      receipt: this.receipt(requestId, rowString(row, 'operation'), resultId, rowNumber(row, 'result_generation'), row.result_revision === null ? null : rowNumber(row, 'result_revision')),
      envelope,
    };
  }

  private turnIntentRow(db: SqlDatabase, principal: HistoryPrincipal, generation: number, id: string, requestId: string): TurnIntentRow | null {
    const value = db.prepare(
      'SELECT generation,id,request_hash,expected_revision,fingerprint,state,last_fence,result_fingerprint,result_id,result_generation,result_revision FROM audit_turn_intents WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ? AND request_hash = ?',
    ).get(principal.userId, principal.accountId, generation, id, requestHash(requestId));
    return value === undefined ? null : asRow(value) as TurnIntentRow;
  }

  private replayTurnIntent(db: SqlDatabase, principal: HistoryPrincipal, requestId: string, intent: TurnIntentRow): HistoryMutationResult {
    const resultId = intent.result_id;
    let envelope: HistoryEnvelope | null = null;
    if (resultId !== null && intent.result_generation !== null) {
      const currentRow = this.getRecordRow(db, principal, rowNumber(intent, 'result_generation'), resultId);
      if (currentRow !== null && rowNumber(currentRow, 'deleted') === 0 && !this.isExpired(currentRow)) envelope = this.readEnvelope(principal, currentRow);
    }
    return {
      receipt: this.receipt(requestId, 'turn', resultId, intent.result_generation ?? intent.generation, intent.result_revision),
      envelope,
    };
  }

  private metadataCount(db: SqlDatabase, principal: HistoryPrincipal, generation: number): number {
    const requestCount = asNumber(asRow(db.prepare(
      'SELECT COUNT(*) AS count FROM audit_requests WHERE user_id = ? AND account_id = ? AND generation = ?',
    ).get(principal.userId, principal.accountId, generation)).count);
    const intentCount = asNumber(asRow(db.prepare(
      'SELECT COUNT(*) AS count FROM audit_turn_intents WHERE user_id = ? AND account_id = ? AND generation = ?',
    ).get(principal.userId, principal.accountId, generation)).count);
    return requestCount + intentCount;
  }

  private ensureMetadataCapacity(db: SqlDatabase, principal: HistoryPrincipal, generation: number): void {
    if (this.metadataCount(db, principal, generation) >= MAX_REQUESTS) capacity();
  }

  private validateMutationKeys(value: unknown, keys: ReadonlySet<string>): asserts value is Record<string, unknown> {
    if (!isPlainObject(value)) invalid();
    exactKeys(value, keys);
  }

  create(principal: HistoryPrincipal, input: CreateHistoryInput): HistoryMutationResult {
    assertPrincipal(principal);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'id', 'title', 'mode', 'language']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    safeOpaque(input.id);
    safeText(input.title, MAX_TITLE_LENGTH);
    assertMode(input.mode);
    assertLanguage(input.language);
    const bodyFingerprint = hashValue({ expectedGeneration: input.expectedGeneration, id: input.id, title: input.title, mode: input.mode, language: input.language });
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      this.assertOrdinaryRequestNamespaceFree(db, principal, generation, input.requestId);
      const existingRequest = this.assertNoChangedRequestBody(db, principal, generation, input.requestId, 'create', input.id, bodyFingerprint);
      if (existingRequest !== null) return this.replayResult(db, principal, input.requestId, existingRequest);
      if (this.getRecordRow(db, principal, generation, input.id) !== null) conflict('AUDIT_HISTORY_ID_EXISTS');
      const liveCount = asNumber(asRow(db.prepare(
        'SELECT COUNT(*) AS count FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0',
      ).get(principal.userId, principal.accountId, generation)).count);
      if (liveCount >= MAX_LIVE_RECORDS) capacity(429);
      const timestamp = nowIso(this.now());
      const record: AuditRecord = {
        id: input.id,
        title: input.title.trim() || 'AI Audit',
        mode: input.mode,
        language: input.language,
        createdAt: timestamp,
        updatedAt: timestamp,
        messages: [],
        intakeState: null,
        assessment: null,
        report: null,
        decision: 'unreviewed',
        pilot: null,
      };
      const envelope: HistoryEnvelope = { schemaVersion: SCHEMA_VERSION, revision: 1, generation, trust: 'provider', record, reportRevisions: [] };
      assertRecord(record);
      this.writeEnvelope(db, principal, envelope, 0);
      this.saveRequest(db, principal, generation, input.requestId, 'create', input.id, bodyFingerprint, null, input.id, generation, 1);
      return { receipt: this.receipt(input.requestId, 'create', input.id, generation, 1), envelope: cloneJson(envelope) };
    });
  }

  list(principal: HistoryPrincipal, cursor?: string): HistoryListResult {
    assertPrincipal(principal);
    if (cursor !== undefined) safeText(cursor, 2048, false);
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      let cursorMs: number | null = null;
      let cursorId: string | null = null;
      if (cursor !== undefined) {
        let decoded: unknown;
        try {
          if (!/^[A-Za-z0-9_-]+$/u.test(cursor)) invalid();
          decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
        } catch {
          invalid();
        }
        if (!isPlainObject(decoded)) invalid();
        exactKeys(decoded, new Set(['v', 'userId', 'accountId', 'generation', 'updatedMs', 'id']));
        if (decoded.v !== 1 || decoded.userId !== principal.userId || decoded.accountId !== principal.accountId || decoded.generation !== generation) invalid();
        safeInteger(decoded.updatedMs, 0);
        safeOpaque(decoded.id);
        cursorMs = decoded.updatedMs;
        cursorId = decoded.id;
      }
      const cutoff = this.retentionCutoff(this.now());
      const rows = (cursorMs === null
        ? cutoff === null
          ? db.prepare('SELECT generation,id,revision,trust,key_id,nonce,ciphertext,tag,payload_size,updated_ms,deleted FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0 ORDER BY updated_ms DESC,id DESC LIMIT 6').all(principal.userId, principal.accountId, generation)
          : db.prepare('SELECT generation,id,revision,trust,key_id,nonce,ciphertext,tag,payload_size,updated_ms,deleted FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0 AND updated_ms > ? ORDER BY updated_ms DESC,id DESC LIMIT 6').all(principal.userId, principal.accountId, generation, cutoff)
        : cutoff === null
          ? db.prepare('SELECT generation,id,revision,trust,key_id,nonce,ciphertext,tag,payload_size,updated_ms,deleted FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0 AND (updated_ms < ? OR (updated_ms = ? AND id < ?)) ORDER BY updated_ms DESC,id DESC LIMIT 6').all(principal.userId, principal.accountId, generation, cursorMs, cursorMs, cursorId)
          : db.prepare('SELECT generation,id,revision,trust,key_id,nonce,ciphertext,tag,payload_size,updated_ms,deleted FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0 AND updated_ms > ? AND (updated_ms < ? OR (updated_ms = ? AND id < ?)) ORDER BY updated_ms DESC,id DESC LIMIT 6').all(principal.userId, principal.accountId, generation, cutoff, cursorMs, cursorMs, cursorId)).map((value) => asRow(value) as RecordRow);
      const hasNext = rows.length > 5;
      const page = hasNext ? rows.slice(0, 5) : rows;
      const items = page.map((row) => this.readEnvelope(principal, row));
      let nextCursor: string | null = null;
      if (hasNext) {
        const last = page[page.length - 1];
        const encoded = JSON.stringify({ v: 1, userId: principal.userId, accountId: principal.accountId, generation, updatedMs: rowNumber(last, 'updated_ms'), id: rowString(last, 'id') });
        nextCursor = Buffer.from(encoded, 'utf8').toString('base64url');
      }
      return { generation, items, nextCursor };
    });
  }

  get(principal: HistoryPrincipal, id: string): HistoryEnvelope {
    assertPrincipal(principal);
    safeOpaque(id);
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      const row = this.getRecordRow(db, principal, generation, id);
      this.ensureLive(row);
      this.ensureNotExpired(row);
      return this.readEnvelope(principal, row);
    });
  }

  update(principal: HistoryPrincipal, id: string, input: UpdateHistoryInput): HistoryMutationResult {
    assertPrincipal(principal);
    safeOpaque(id);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'expectedRevision', 'title', 'decision', 'pilot']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    safeInteger(input.expectedRevision);
    if (!hasOwn(input, 'title') && !hasOwn(input, 'decision') && !hasOwn(input, 'pilot')) invalid();
    if (hasOwn(input, 'title')) safeText(input.title, MAX_TITLE_LENGTH);
    if (hasOwn(input, 'decision') && input.decision !== 'unreviewed' && input.decision !== 'prepare' && input.decision !== 'defer') invalid();
    if (hasOwn(input, 'pilot')) assertPilot(input.pilot);
    const bodyFingerprint = hashValue({ expectedGeneration: input.expectedGeneration, expectedRevision: input.expectedRevision, title: input.title, decision: input.decision, pilot: input.pilot });
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      this.assertOrdinaryRequestNamespaceFree(db, principal, generation, input.requestId);
      const row = this.getRecordRow(db, principal, generation, id);
      const existingRequest = this.assertNoChangedRequestBody(db, principal, generation, input.requestId, 'update', id, bodyFingerprint);
      if (existingRequest !== null) return this.replayResult(db, principal, input.requestId, existingRequest);
      this.ensureLive(row);
      this.ensureNotExpired(row);
      if (rowNumber(row, 'revision') !== input.expectedRevision) conflict('AUDIT_HISTORY_REVISION_CONFLICT');
      const current = this.readEnvelope(principal, row);
      const record: AuditRecord = {
        ...current.record,
        ...(hasOwn(input, 'title') ? { title: input.title as string } : {}),
        ...(hasOwn(input, 'decision') ? { decision: input.decision as AuditRecord['decision'] } : {}),
        ...(hasOwn(input, 'pilot') ? { pilot: cloneJson(input.pilot) as Pilot | null } : {}),
        updatedAt: nowIso(this.now()),
      };
      const envelope: HistoryEnvelope = { ...current, revision: current.revision + 1, record };
      assertRecord(record);
      this.writeEnvelope(db, principal, envelope, rowNumber(row, 'payload_size'));
      this.saveRequest(db, principal, generation, input.requestId, 'update', id, bodyFingerprint, null, id, generation, envelope.revision);
      return { receipt: this.receipt(input.requestId, 'update', id, generation, envelope.revision), envelope: cloneJson(envelope) };
    });
  }

  remove(principal: HistoryPrincipal, id: string, input: { requestId: string; expectedGeneration: number; expectedRevision: number }): HistoryMutationResult {
    assertPrincipal(principal);
    safeOpaque(id);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'expectedRevision']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    safeInteger(input.expectedRevision);
    const bodyFingerprint = hashValue({ expectedGeneration: input.expectedGeneration, expectedRevision: input.expectedRevision });
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      this.assertOrdinaryRequestNamespaceFree(db, principal, generation, input.requestId);
      const row = this.getRecordRow(db, principal, generation, id);
      const existingRequest = this.assertNoChangedRequestBody(db, principal, generation, input.requestId, 'remove', id, bodyFingerprint);
      if (existingRequest !== null) return this.replayResult(db, principal, input.requestId, existingRequest);
      this.ensureLive(row);
      this.ensureNotExpired(row);
      if (rowNumber(row, 'revision') !== input.expectedRevision) conflict('AUDIT_HISTORY_REVISION_CONFLICT');
      const tombstones = asNumber(asRow(db.prepare(
        'SELECT COUNT(*) AS count FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 1',
      ).get(principal.userId, principal.accountId, generation)).count);
      if (tombstones >= MAX_TOMBSTONES) capacity();
      const committedRevision = input.expectedRevision + 1;
      db.prepare(
        'UPDATE audit_records SET revision = ?, key_id = NULL, nonce = NULL, ciphertext = NULL, tag = NULL, payload_size = 0, updated_ms = ?, deleted = 1 WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?',
      ).run(committedRevision, this.now(), principal.userId, principal.accountId, generation, id);
      db.prepare('DELETE FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?').run(principal.userId, principal.accountId, generation, id);
      this.saveRequest(db, principal, generation, input.requestId, 'remove', id, bodyFingerprint, null, id, generation, committedRevision);
      return { receipt: this.receipt(input.requestId, 'remove', id, generation, committedRevision), envelope: null };
    });
  }

  clear(principal: HistoryPrincipal, input: { requestId: string; expectedGeneration: number; confirmation: 'clear_audit_history' }): HistoryMutationResult {
    assertPrincipal(principal);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'confirmation']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    if (input.confirmation !== 'clear_audit_history') invalid();
    const bodyFingerprint = hashValue({ expectedGeneration: input.expectedGeneration, confirmation: input.confirmation });
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      const previous = db.prepare(
        'SELECT body_fingerprint,new_generation FROM audit_clear_receipts WHERE user_id = ? AND account_id = ? AND old_generation = ? AND request_hash = ?',
      ).get(principal.userId, principal.accountId, input.expectedGeneration, requestHash(input.requestId));
      if (previous !== undefined) {
        const row = asRow(previous);
        if (rowString(row, 'body_fingerprint') !== bodyFingerprint) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
        return { receipt: this.receipt(input.requestId, 'clear', null, rowNumber(row, 'new_generation'), null), envelope: null };
      }
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      this.assertOrdinaryRequestNamespaceFree(db, principal, generation, input.requestId);
      const receiptCount = asNumber(asRow(db.prepare(
        'SELECT COUNT(*) AS count FROM audit_clear_receipts WHERE user_id = ? AND account_id = ?',
      ).get(principal.userId, principal.accountId)).count);
      if (receiptCount >= MAX_CLEAR_RECEIPTS) capacity();
      const nextGeneration = generation + 1;
      db.prepare('DELETE FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ?').run(principal.userId, principal.accountId, generation);
      db.prepare('DELETE FROM audit_requests WHERE user_id = ? AND account_id = ? AND generation = ?').run(principal.userId, principal.accountId, generation);
      db.prepare('DELETE FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ?').run(principal.userId, principal.accountId, generation);
      db.prepare('DELETE FROM audit_turn_intents WHERE user_id = ? AND account_id = ? AND generation = ?').run(principal.userId, principal.accountId, generation);
      db.prepare('UPDATE audit_owner_state SET generation = ? WHERE user_id = ? AND account_id = ?').run(nextGeneration, principal.userId, principal.accountId);
      db.prepare(
        'INSERT INTO audit_clear_receipts (user_id,account_id,old_generation,request_hash,body_fingerprint,new_generation) VALUES (?,?,?,?,?,?)',
      ).run(principal.userId, principal.accountId, generation, requestHash(input.requestId), bodyFingerprint, nextGeneration);
      return { receipt: this.receipt(input.requestId, 'clear', null, nextGeneration, null), envelope: null };
    });
  }

  importArchive(principal: HistoryPrincipal, input: ImportHistoryInput): HistoryMutationResult {
    assertPrincipal(principal);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'record']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    assertRecord(input.record);
    const serializedInput = Buffer.from(stableStringify(input.record), 'utf8');
    if (serializedInput.byteLength > MAX_IMPORT_BYTES) capacity(413);
    const bodyFingerprint = hashValue({ expectedGeneration: input.expectedGeneration, record: input.record });
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      this.assertOrdinaryRequestNamespaceFree(db, principal, generation, input.requestId);
      const existingRequest = this.assertNoChangedRequestBody(db, principal, generation, input.requestId, 'import', '', bodyFingerprint);
      if (existingRequest !== null) return this.replayResult(db, principal, input.requestId, existingRequest);
      const liveCount = asNumber(asRow(db.prepare(
        'SELECT COUNT(*) AS count FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 0',
      ).get(principal.userId, principal.accountId, generation)).count);
      if (liveCount >= MAX_LIVE_RECORDS) capacity(429);
      const timestamp = nowIso(this.now());
      const id = this.newRecordId(db, principal, generation);
      const record: AuditRecord = { ...cloneJson(input.record), id, createdAt: timestamp, updatedAt: timestamp };
      const envelope: HistoryEnvelope = { schemaVersion: SCHEMA_VERSION, revision: 1, generation, trust: 'imported_unverified', record, reportRevisions: [] };
      assertRecord(record);
      this.writeEnvelope(db, principal, envelope, 0);
      this.saveRequest(db, principal, generation, input.requestId, 'import', '', bodyFingerprint, null, id, generation, 1);
      return { receipt: this.receipt(input.requestId, 'import', id, generation, 1), envelope: cloneJson(envelope) };
    });
  }

  private newRecordId(db: SqlDatabase, principal: HistoryPrincipal, generation: number): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const id = `audit-${randomUUID()}`;
      if (this.getRecordRow(db, principal, generation, id) === null) return id;
    }
    capacity();
  }

  reserveTurn(principal: HistoryPrincipal, id: string, input: ReserveTurnInput): ReserveTurnResult {
    assertPrincipal(principal);
    safeOpaque(id);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'expectedRevision', 'fingerprint']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    safeInteger(input.expectedRevision);
    safeText(input.fingerprint, 512, false);
    const bodyFingerprint = hashValue({ fingerprint: input.fingerprint });
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      const currentRow = this.getRecordRow(db, principal, generation, id);
      const intent = this.turnIntentRow(db, principal, generation, id, input.requestId);
      if (intent !== null) {
        this.assertTurnNamespaceFreeOfOrdinaryRequest(db, principal, generation, input.requestId);
        if (rowNumber(intent, 'expected_revision') !== input.expectedRevision || rowString(intent, 'fingerprint') !== bodyFingerprint) {
          conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
        }
        if (intent.state === 'completed') return { kind: 'replayed', result: this.replayTurnIntent(db, principal, input.requestId, intent) };
      } else {
        // A request ID already used by a non-turn operation cannot silently
        // become a turn intent for the same owner/generation.
        const request = this.turnRequestNamespaceRow(db, principal, generation, input.requestId, id);
        if (request !== null) return { kind: 'replayed', result: this.replayResult(db, principal, input.requestId, request) };
        this.ensureMetadataCapacity(db, principal, generation);
        db.prepare(
          'INSERT INTO audit_turn_intents (user_id,account_id,generation,id,request_hash,expected_revision,fingerprint,state,last_fence,result_fingerprint,result_id,result_generation,result_revision) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ).run(principal.userId, principal.accountId, generation, id, requestHash(input.requestId), input.expectedRevision, bodyFingerprint, 'pending', '', null, null, null, null);
      }
      this.ensureLive(currentRow);
      this.ensureNotExpired(currentRow);
      if (rowNumber(currentRow, 'revision') !== input.expectedRevision) conflict('AUDIT_HISTORY_REVISION_CONFLICT');
      if (currentRow.trust !== 'provider') throw new HistoryError(409, 'AUDIT_HISTORY_UNTRUSTED');
      const now = this.now();
      const leaseValue = db.prepare(
        'SELECT generation,id,request_hash,fingerprint,revision,fence,expires_ms FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?',
      ).get(principal.userId, principal.accountId, generation, id);
      if (leaseValue !== undefined) {
        const lease = asRow(leaseValue) as LeaseRow;
        if (rowNumber(lease, 'expires_ms') > now) throw new HistoryError(409, 'AUDIT_TURN_BUSY');
        db.prepare('DELETE FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?').run(principal.userId, principal.accountId, generation, id);
      }
      const fence = randomBytes(32).toString('base64url');
      const expiresAt = now + TURN_LEASE_MS;
      db.prepare(
        'INSERT INTO audit_turn_leases (user_id,account_id,generation,id,request_hash,fingerprint,revision,fence,expires_ms) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(principal.userId, principal.accountId, generation, id, requestHash(input.requestId), bodyFingerprint, input.expectedRevision, fence, expiresAt);
      db.prepare(
        'UPDATE audit_turn_intents SET state = ?, last_fence = ? WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ? AND request_hash = ?',
      ).run('pending', fence, principal.userId, principal.accountId, generation, id, requestHash(input.requestId));
      return { kind: 'reserved', envelope: this.readEnvelope(principal, currentRow), lease: { fence, expiresAt } };
    });
  }

  commitTurn(principal: HistoryPrincipal, id: string, input: CommitTurnInput): HistoryMutationResult {
    assertPrincipal(principal);
    safeOpaque(id);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'expectedRevision', 'fence', 'record']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    safeInteger(input.expectedRevision);
    safeOpaque(input.fence, 512);
    assertRecord(input.record);
    const resultFingerprint = hashValue(input.record);
    return this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      const currentRow = this.getRecordRow(db, principal, generation, id);
      this.assertTurnNamespaceFreeOfOrdinaryRequest(db, principal, generation, input.requestId);
      const intent = this.turnIntentRow(db, principal, generation, id, input.requestId);
      if (intent === null) throw new HistoryError(409, 'AUDIT_HISTORY_TURN_FENCE_INVALID');
      if (rowNumber(intent, 'expected_revision') !== input.expectedRevision) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
      if (intent.state === 'completed') {
        if (intent.result_fingerprint !== resultFingerprint) conflict('AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
        return this.replayTurnIntent(db, principal, input.requestId, intent);
      }
      this.ensureLive(currentRow);
      this.ensureNotExpired(currentRow);
      if (rowNumber(currentRow, 'revision') !== input.expectedRevision) conflict('AUDIT_HISTORY_REVISION_CONFLICT');
      if (currentRow.trust !== 'provider') throw new HistoryError(409, 'AUDIT_HISTORY_UNTRUSTED');
      const leaseValue = db.prepare(
        'SELECT generation,id,request_hash,fingerprint,revision,fence,expires_ms FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?',
      ).get(principal.userId, principal.accountId, generation, id);
      if (leaseValue === undefined) throw new HistoryError(409, 'AUDIT_HISTORY_TURN_FENCE_INVALID');
      const lease = asRow(leaseValue) as LeaseRow;
      if (rowString(lease, 'request_hash') !== requestHash(input.requestId) || rowString(lease, 'fence') !== input.fence || rowNumber(lease, 'revision') !== input.expectedRevision || rowNumber(lease, 'expires_ms') <= this.now()) {
        throw new HistoryError(409, 'AUDIT_HISTORY_TURN_FENCE_INVALID');
      }
      const current = this.readEnvelope(principal, currentRow);
      const reportRevisions = cloneJson(current.reportRevisions);
      const reportChanged = current.record.report !== input.record.report
        || stableStringify(current.record.assessment) !== stableStringify(input.record.assessment);
      if (reportChanged) {
        if (current.record.report !== null) {
          if (reportRevisions.length >= MAX_REPORT_REVISIONS) capacity();
          reportRevisions.push({ revision: current.revision, createdAt: current.record.updatedAt, report: current.record.report, assessment: cloneJson(current.record.assessment) });
        }
      }
      assertReportRevisions(reportRevisions);
      const record: AuditRecord = {
        ...cloneJson(input.record),
        id,
        title: current.record.title,
        mode: current.record.mode,
        language: current.record.language,
        createdAt: current.record.createdAt,
        updatedAt: nowIso(this.now()),
        // A report completion or correction supersedes the previous
        // recommendation. Keep owner decision metadata for ordinary turns,
        // but never let canonical/model `prepare` promote the next state.
        decision: input.record.report !== null
          || current.record.report !== null
          || current.record.intakeState?.complete === true
          ? 'unreviewed'
          : current.record.decision,
        pilot: cloneJson(current.record.pilot),
      };
      assertRecord(record);
      const envelope: HistoryEnvelope = { schemaVersion: SCHEMA_VERSION, revision: current.revision + 1, generation, trust: current.trust, record, reportRevisions };
      this.writeEnvelope(db, principal, envelope, rowNumber(currentRow, 'payload_size'));
      db.prepare('DELETE FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?').run(principal.userId, principal.accountId, generation, id);
      db.prepare(
        'UPDATE audit_turn_intents SET state = ?, last_fence = ?, result_fingerprint = ?, result_id = ?, result_generation = ?, result_revision = ? WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ? AND request_hash = ?',
      ).run('completed', input.fence, resultFingerprint, id, generation, envelope.revision, principal.userId, principal.accountId, generation, id, requestHash(input.requestId));
      return { receipt: this.receipt(input.requestId, 'turn', id, generation, envelope.revision), envelope: cloneJson(envelope) };
    });
  }

  releaseTurn(principal: HistoryPrincipal, id: string, input: ReleaseTurnInput): void {
    assertPrincipal(principal);
    safeOpaque(id);
    this.validateMutationKeys(input, new Set(['requestId', 'expectedGeneration', 'fence']));
    assertRequestId(input.requestId);
    safeInteger(input.expectedGeneration);
    safeOpaque(input.fence, 512);
    this.transaction((db) => {
      const generation = this.ensureOwner(db, principal);
      if (generation !== input.expectedGeneration) conflict('AUDIT_HISTORY_GENERATION_CONFLICT');
      this.assertTurnNamespaceFreeOfOrdinaryRequest(db, principal, generation, input.requestId);
      const intent = this.turnIntentRow(db, principal, generation, id, input.requestId);
      if (intent === null || intent.state === 'completed') throw new HistoryError(409, 'AUDIT_HISTORY_TURN_FENCE_INVALID');
      const leaseValue = db.prepare(
        'SELECT generation,id,request_hash,fingerprint,revision,fence,expires_ms FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?',
      ).get(principal.userId, principal.accountId, generation, id);
      if (leaseValue === undefined) {
        if (intent.state === 'released' && intent.last_fence === input.fence) return;
        throw new HistoryError(409, 'AUDIT_HISTORY_TURN_FENCE_INVALID');
      }
      const lease = asRow(leaseValue);
      if (rowString(lease, 'fence') !== input.fence || rowString(lease, 'request_hash') !== requestHash(input.requestId)) {
        throw new HistoryError(409, 'AUDIT_HISTORY_TURN_FENCE_INVALID');
      }
      db.prepare('DELETE FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?').run(principal.userId, principal.accountId, generation, id);
      db.prepare(
        'UPDATE audit_turn_intents SET state = ?, last_fence = ? WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ? AND request_hash = ?',
      ).run('released', input.fence, principal.userId, principal.accountId, generation, id, requestHash(input.requestId));
    });
  }

  purgeExpired(): number {
    if (this.retention === 'owner_delete') return 0;
    const purgeTime = this.now();
    const cutoff = purgeTime - this.retention.days * 24 * 60 * 60 * 1000;
    return this.transaction((db) => {
      const rows = db.prepare(
        'SELECT user_id,account_id,generation,id,revision FROM audit_records WHERE deleted = 0 AND updated_ms <= ?',
      ).all(cutoff).map(asRow);
      const additions = new Map<string, number>();
      for (const row of rows) {
        const ownerGeneration = `${rowString(row, 'user_id')}\u0000${rowString(row, 'account_id')}\u0000${rowNumber(row, 'generation')}`;
        additions.set(ownerGeneration, (additions.get(ownerGeneration) ?? 0) + 1);
      }
      for (const [ownerGeneration, additionCount] of additions) {
        const [userId, accountId, generationText] = ownerGeneration.split('\u0000');
        const tombstones = asNumber(asRow(db.prepare(
          'SELECT COUNT(*) AS count FROM audit_records WHERE user_id = ? AND account_id = ? AND generation = ? AND deleted = 1',
        ).get(userId, accountId, Number(generationText))).count);
        if (tombstones + additionCount > MAX_TOMBSTONES) capacity();
      }
      let purged = 0;
      for (const row of rows) {
        db.prepare(
          'UPDATE audit_records SET revision = ?, key_id = NULL, nonce = NULL, ciphertext = NULL, tag = NULL, payload_size = 0, updated_ms = ?, deleted = 1 WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ? AND deleted = 0',
        ).run(rowNumber(row, 'revision') + 1, purgeTime, rowString(row, 'user_id'), rowString(row, 'account_id'), rowNumber(row, 'generation'), rowString(row, 'id'));
        db.prepare('DELETE FROM audit_turn_leases WHERE user_id = ? AND account_id = ? AND generation = ? AND id = ?').run(rowString(row, 'user_id'), rowString(row, 'account_id'), rowNumber(row, 'generation'), rowString(row, 'id'));
        purged += 1;
      }
      return purged;
    });
  }
}
