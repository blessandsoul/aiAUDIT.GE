import type { AuditRecord, AuditMode, AuditLanguage, Pilot } from './types.ts';

export const HISTORY_LIMITS = Object.freeze({
  maxRequestId: 200,
  maxRecordId: 200,
  maxCursor: 2_048,
  maxTitle: 200,
  maxTurnContent: 3_000,
  maxBodyBytes: 1 * 1024 * 1024,
  maxImportBytes: 256 * 1024,
  maxMessages: 200,
  maxMessageChars: 20_000,
  maxHistoryEntries: 160,
  maxFactKeys: 120,
  maxAskedKeys: 120,
  maxFieldId: 200,
  maxPilotField: 4_000,
  maxReportChars: 20_000,
  maxImportDepth: 12,
  maxImportNodes: 20_000,
});

const SAFE_ID = /^[A-Za-z0-9_.-]{1,200}$/u;
const SAFE_CURSOR = /^[A-Za-z0-9_-]{1,2048}$/u;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const RECORD_KEYS = new Set([
  'id', 'title', 'mode', 'language', 'createdAt', 'updatedAt', 'messages',
  'intakeState', 'assessment', 'report', 'decision', 'pilot',
]);
const STATE_KEYS = new Set([
  'version', 'mode', 'turn', 'language', 'focus', 'focusQuote', 'facts',
  'asked', 'currentQuestion', 'complete', 'stopReason', 'history', 'proof',
  'publicScan',
]);
const FACT_KEYS = new Set(['id', 'field', 'value', 'status', 'quote', 'turn', 'previous']);
const PREVIOUS_KEYS = new Set(['value', 'quote']);
const MESSAGE_KEYS = new Set(['id', 'role', 'content', 'suggestions']);
const ASSESSMENT_KEYS = new Set(['verdict', 'product', 'opportunity', 'readiness', 'evidence']);
const PILOT_KEYS = new Set(['owner', 'metric', 'baseline', 'target', 'observed', 'stopRule', 'status']);
const PUBLIC_SCAN_KEYS = new Set(['sources', 'observations', 'aiStatus']);
const PUBLIC_SOURCE_KEYS = new Set(['id', 'url', 'checkedAt', 'status', 'title', 'excerpt', 'provider', 'recordType', 'runId', 'datasetId', 'verification', 'receiptId']);
const PUBLIC_OBSERVATION_KEYS = new Set(['sourceId', 'kind', 'quote']);

export type HistoryOperation = 'list' | 'create' | 'read' | 'update' | 'remove' | 'clear' | 'turn' | 'import';

export class AuditHistoryValidationError extends Error {
  readonly status = 400;
  readonly code = 'AUDIT_HISTORY_INVALID_INPUT';

  constructor() {
    super('Invalid audit history request');
    this.name = 'AuditHistoryValidationError';
  }
}

function invalid(): never {
  throw new AuditHistoryValidationError();
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function exactKeys(value: object, allowed: ReadonlySet<string>): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) invalid();
}

function text(value: unknown, max: number, required = false): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (required && value.length === 0) || CONTROL.test(value)) invalid();
}

function safeId(value: unknown, max = HISTORY_LIMITS.maxRecordId): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || !SAFE_ID.test(value) || value === '.' || value === '..') invalid();
}

function opaque(value: unknown, max: number): asserts value is string {
  text(value, max, true);
}

function integer(value: unknown, minimum: number): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) invalid();
}

function dateText(value: unknown): asserts value is string {
  text(value, 64, true);
  if (!Number.isFinite(Date.parse(value))) invalid();
}

function mode(value: unknown): asserts value is AuditMode {
  if (value !== 'quick' && value !== 'deep') invalid();
}

function language(value: unknown): asserts value is AuditLanguage {
  if (value !== 'ka' && value !== 'ru' && value !== 'en') invalid();
}

function boundedJson(value: unknown, depth = 0, state = { nodes: 0 }): void {
  state.nodes += 1;
  if (state.nodes > HISTORY_LIMITS.maxImportNodes || depth > HISTORY_LIMITS.maxImportDepth) invalid();
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    text(value, HISTORY_LIMITS.maxMessageChars);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) invalid();
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > HISTORY_LIMITS.maxMessages) invalid();
    for (const item of value) boundedJson(item, depth + 1, state);
    return;
  }
  if (!isObject(value)) invalid();
  if (Object.keys(value).length > HISTORY_LIMITS.maxMessages) invalid();
  for (const [key, item] of Object.entries(value)) {
    opaque(key, HISTORY_LIMITS.maxFieldId);
    boundedJson(item, depth + 1, state);
  }
}

function message(value: unknown): void {
  if (!isObject(value)) invalid();
  exactKeys(value, MESSAGE_KEYS);
  safeId(value.id);
  if (value.role !== 'user' && value.role !== 'assistant') invalid();
  text(value.content, HISTORY_LIMITS.maxMessageChars);
  if (hasOwn(value, 'suggestions')) {
    if (!Array.isArray(value.suggestions) || value.suggestions.length > 12) invalid();
    for (const suggestion of value.suggestions) text(suggestion, 500);
  }
}

function pilot(value: unknown): asserts value is Pilot | null {
  if (value === null) return;
  if (!isObject(value)) invalid();
  exactKeys(value, PILOT_KEYS);
  for (const key of ['owner', 'metric', 'baseline', 'target', 'observed', 'stopRule']) text(value[key], HISTORY_LIMITS.maxPilotField);
  if (!['draft', 'measuring', 'review', 'completed'].includes(value.status as string)) invalid();
}

function assessment(value: unknown): void {
  if (value === null) return;
  if (!isObject(value)) invalid();
  exactKeys(value, ASSESSMENT_KEYS);
  text(value.verdict, 200, true);
  if (value.product !== null) text(value.product, 200);
  text(value.opportunity, 200, true);
  text(value.readiness, 200, true);
  if (!Array.isArray(value.evidence) || value.evidence.length > HISTORY_LIMITS.maxFactKeys) invalid();
  for (const item of value.evidence) text(item, HISTORY_LIMITS.maxMessageChars, true);
}

function previous(value: unknown): void {
  if (!isObject(value)) invalid();
  exactKeys(value, PREVIOUS_KEYS);
  text(value.value, HISTORY_LIMITS.maxMessageChars);
  text(value.quote, HISTORY_LIMITS.maxMessageChars);
}

function fact(value: unknown): void {
  if (!isObject(value)) invalid();
  exactKeys(value, FACT_KEYS);
  safeId(value.id);
  opaque(value.field, HISTORY_LIMITS.maxFieldId);
  text(value.value, HISTORY_LIMITS.maxMessageChars);
  if (!['confirmed', 'estimated', 'partial', 'unknown', 'declined', 'not_applicable', 'contradicted'].includes(value.status as string)) invalid();
  text(value.quote, HISTORY_LIMITS.maxMessageChars);
  integer(value.turn, 0);
  if (hasOwn(value, 'previous')) previous(value.previous);
}

function publicScan(value: unknown): void {
  if (!isObject(value)) invalid();
  exactKeys(value, PUBLIC_SCAN_KEYS);
  if (!Array.isArray(value.sources) || value.sources.length > 64) invalid();
  for (const item of value.sources) {
    if (!isObject(item)) invalid();
    exactKeys(item, PUBLIC_SOURCE_KEYS);
    opaque(item.id, HISTORY_LIMITS.maxFieldId);
    text(item.url, 2_048, true);
    dateText(item.checkedAt);
    if (!['read', 'unavailable', 'restricted'].includes(item.status as string)) invalid();
    text(item.title, 2_000);
    text(item.excerpt, HISTORY_LIMITS.maxMessageChars);
    if (hasOwn(item, 'provider') && item.provider !== 'apify') invalid();
    if (hasOwn(item, 'recordType') && !['post', 'comment'].includes(item.recordType as string)) invalid();
    for (const key of ['runId', 'datasetId', 'verification', 'receiptId']) if (hasOwn(item, key)) text(item[key], HISTORY_LIMITS.maxFieldId);
    if (hasOwn(item, 'verification') && item.verification !== 'provider_only') invalid();
  }
  if (!Array.isArray(value.observations) || value.observations.length > 4) invalid();
  for (const item of value.observations) {
    if (!isObject(item)) invalid();
    exactKeys(item, PUBLIC_OBSERVATION_KEYS);
    opaque(item.sourceId, HISTORY_LIMITS.maxFieldId);
    if (!['business', 'offering', 'contact', 'booking'].includes(item.kind as string)) invalid();
    text(item.quote, 320, true);
  }
  if (value.aiStatus !== 'reviewed' && value.aiStatus !== 'unavailable') invalid();
}

function intakeState(value: unknown): void {
  if (value === null) return;
  if (!isObject(value)) invalid();
  exactKeys(value, STATE_KEYS);
  if (value.version !== 2) invalid();
  mode(value.mode);
  integer(value.turn, 0);
  language(value.language);
  opaque(value.focus, HISTORY_LIMITS.maxFieldId);
  text(value.focusQuote, HISTORY_LIMITS.maxMessageChars);
  if (!isObject(value.facts) || Object.keys(value.facts).length > HISTORY_LIMITS.maxFactKeys) invalid();
  for (const [key, item] of Object.entries(value.facts)) {
    opaque(key, HISTORY_LIMITS.maxFieldId);
    fact(item);
  }
  if (!isObject(value.asked) || Object.keys(value.asked).length > HISTORY_LIMITS.maxAskedKeys) invalid();
  for (const [key, count] of Object.entries(value.asked)) {
    opaque(key, HISTORY_LIMITS.maxFieldId);
    integer(count, 0);
    if (count > 1_000) invalid();
  }
  if (value.currentQuestion !== null) opaque(value.currentQuestion, HISTORY_LIMITS.maxFieldId);
  if (typeof value.complete !== 'boolean') invalid();
  if (value.stopReason !== null && value.stopReason !== 'enough' && value.stopReason !== 'limited') invalid();
  if (!Array.isArray(value.history) || value.history.length > HISTORY_LIMITS.maxHistoryEntries) invalid();
  for (const item of value.history) {
    if (!isObject(item)) invalid();
    exactKeys(item, new Set(['role', 'content']));
    if (item.role !== 'user' && item.role !== 'assistant') invalid();
    text(item.content, HISTORY_LIMITS.maxMessageChars);
  }
  if (hasOwn(value, 'proof') && value.proof !== null) text(value.proof, 512);
  if (hasOwn(value, 'publicScan')) publicScan(value.publicScan);
}

function record(value: unknown): asserts value is AuditRecord {
  if (!isObject(value)) invalid();
  exactKeys(value, RECORD_KEYS);
  safeId(value.id);
  text(value.title, HISTORY_LIMITS.maxTitle);
  mode(value.mode);
  language(value.language);
  dateText(value.createdAt);
  dateText(value.updatedAt);
  if (!Array.isArray(value.messages) || value.messages.length > HISTORY_LIMITS.maxMessages) invalid();
  for (const item of value.messages) message(item);
  intakeState(value.intakeState);
  assessment(value.assessment);
  if (value.report !== null) text(value.report, HISTORY_LIMITS.maxReportChars);
  if (!['unreviewed', 'prepare', 'defer'].includes(value.decision as string)) invalid();
  pilot(value.pilot);
  boundedJson(value);
}

function recordBytes(value: unknown): number {
  try {
    const encoded = JSON.stringify(value);
    if (typeof encoded !== 'string') invalid();
    return Buffer.byteLength(encoded, 'utf8');
  } catch {
    invalid();
  }
}

export function validatePathSegments(value: readonly string[]): readonly string[] {
  if (!Array.isArray(value) || value.length > 2) invalid();
  const segments = value.map((segment) => {
    if (typeof segment !== 'string' || segment.length === 0 || segment.includes('%') || /[\\/\u0000-\u001f\u007f]/u.test(segment)) invalid();
    return segment;
  });
  if (segments.length === 0) return segments;
  if (segments.length === 1 && segments[0] === 'import') return segments;
  safeId(segments[0]);
  if (segments.length === 2 && segments[1] !== 'turn') invalid();
  return segments;
}

export function validateCursor(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !SAFE_CURSOR.test(value) || value === '.' || value === '..') invalid();
  return value;
}

export function validateOperationBody(operation: Exclude<HistoryOperation, 'list' | 'read'>, value: unknown): Record<string, unknown> {
  if (!isObject(value)) invalid();
  if (operation === 'create') {
    exactKeys(value, new Set(['id', 'requestId', 'expectedGeneration', 'title', 'mode', 'language']));
    safeId(value.id);
    opaque(value.requestId, HISTORY_LIMITS.maxRequestId);
    integer(value.expectedGeneration, 0);
    text(value.title, HISTORY_LIMITS.maxTitle);
    mode(value.mode);
    language(value.language);
    return value;
  }
  if (operation === 'update') {
    exactKeys(value, new Set(['requestId', 'expectedGeneration', 'expectedRevision', 'title', 'decision', 'pilot']));
    opaque(value.requestId, HISTORY_LIMITS.maxRequestId);
    integer(value.expectedGeneration, 0);
    integer(value.expectedRevision, 1);
    if (!hasOwn(value, 'title') && !hasOwn(value, 'decision') && !hasOwn(value, 'pilot')) invalid();
    if (hasOwn(value, 'title')) text(value.title, HISTORY_LIMITS.maxTitle);
    if (hasOwn(value, 'decision') && !['unreviewed', 'prepare', 'defer'].includes(value.decision as string)) invalid();
    if (hasOwn(value, 'pilot')) pilot(value.pilot);
    return value;
  }
  if (operation === 'turn') {
    exactKeys(value, new Set(['requestId', 'expectedGeneration', 'expectedRevision', 'content', 'finish']));
    opaque(value.requestId, HISTORY_LIMITS.maxRequestId);
    integer(value.expectedGeneration, 0);
    integer(value.expectedRevision, 1);
    text(value.content, HISTORY_LIMITS.maxTurnContent, true);
    if (!value.content.trim()) invalid();
    if (hasOwn(value, 'finish') && typeof value.finish !== 'boolean') invalid();
    return value;
  }
  if (operation === 'remove') {
    exactKeys(value, new Set(['requestId', 'expectedGeneration', 'expectedRevision']));
    opaque(value.requestId, HISTORY_LIMITS.maxRequestId);
    integer(value.expectedGeneration, 0);
    integer(value.expectedRevision, 1);
    return value;
  }
  if (operation === 'clear') {
    exactKeys(value, new Set(['requestId', 'expectedGeneration', 'confirmation']));
    opaque(value.requestId, HISTORY_LIMITS.maxRequestId);
    integer(value.expectedGeneration, 0);
    if (value.confirmation !== 'clear_audit_history') invalid();
    return value;
  }
  if (operation === 'import') {
    exactKeys(value, new Set(['requestId', 'expectedGeneration', 'record']));
    opaque(value.requestId, HISTORY_LIMITS.maxRequestId);
    integer(value.expectedGeneration, 0);
    record(value.record);
    if (recordBytes(value.record) > HISTORY_LIMITS.maxImportBytes) invalid();
    return value;
  }
  invalid();
}

export function validateImportedRecord(value: unknown): AuditRecord {
  record(value);
  if (recordBytes(value) > HISTORY_LIMITS.maxImportBytes) invalid();
  return value;
}

export function isSafeRecordId(value: string): boolean {
  return SAFE_ID.test(value) && value !== '.' && value !== '..';
}
