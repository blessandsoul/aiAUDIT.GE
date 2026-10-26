import { createHash, randomUUID } from 'node:crypto';

import {
  advanceAudit,
  assess,
  auditTurnLimit,
  createIntakeState,
  questionFor,
  type Extraction,
  type IntakeState as EngineIntakeState,
} from '../audit-engine.ts';
import { buildFinalBrief } from '../audit-report.ts';
import { checkAuditStateProof, signState } from '../audit-session.ts';
import { containsAuditCredentials, containsSensitiveAuditInput } from '../audit-input-security.ts';
import { extract as realExtract } from '../audit-extractor.ts';
import { HistoryStore } from './store.ts';
import {
  HistoryError,
  type AuditRecord,
  type HistoryEnvelope,
  type HistoryListResult,
  type HistoryMutationResult,
  type HistoryPrincipal,
  type CreateHistoryInput,
  type UpdateHistoryInput,
  type ImportHistoryInput,
} from './types.ts';
import { validateImportedRecord, validateOperationBody } from './validation.ts';

// The engine owns the actual extractor contract. Production uses the real
// extractor; tests inject a pure fixture function and therefore never need a
// model or network call.
export type AuditHistoryExtractor = (
  state: EngineIntakeState,
  content: string,
  thinking?: boolean,
) => Promise<Extraction>;

export type AuditHistoryServiceDeps = Readonly<{
  store: HistoryStore;
  extractor?: AuditHistoryExtractor;
  extract?: AuditHistoryExtractor;
  now?: () => number;
}>;

export class AuditHistoryServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AuditHistoryServiceError';
    this.status = status;
    this.code = code;
  }
}

const SERVICE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUDIT_HISTORY_STATE_EXPIRED: 'Audit history state has expired',
  AUDIT_HISTORY_INVALID_STATE: 'Audit history state is invalid',
  AUDIT_HISTORY_STATE_UNAVAILABLE: 'Audit history state is unavailable',
  AUDIT_HISTORY_MODEL_FAILURE: 'Audit history processing is unavailable',
  AUDIT_HISTORY_TURN_LIMIT: 'Audit history turn limit reached',
  AUDIT_HISTORY_DELETED: 'Audit history has been deleted',
  AUDIT_SENSITIVE_INPUT: 'Sensitive input is not accepted',
});

function serviceError(status: number, code: string): never {
  throw new AuditHistoryServiceError(status, code, SERVICE_MESSAGES[code] ?? 'Audit history is unavailable');
}

const EMPTY_EXTRACTION: Extraction = { focus: 'discovery', focusEvidence: '', updates: [], nextField: null };

function stableFingerprint(value: unknown): string {
  // Request fields are validated before reaching this function. This explicit
  // order is deliberately scoped to the turn intent and keeps store-level
  // idempotency independent from the raw request object insertion order. The
  // store accepts only a bounded fingerprint string; hash the complete
  // validated intent instead of truncating a long answer.
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('base64url');
}

function scanSensitive(value: unknown, seen = new Set<unknown>()): void {
  if (typeof value === 'string') {
    if (containsSensitiveAuditInput(value)) serviceError(400, 'AUDIT_SENSITIVE_INPUT');
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (seen.has(value)) serviceError(400, 'AUDIT_HISTORY_INVALID_INPUT');
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) scanSensitive(item, seen);
  } else {
    for (const item of Object.values(value)) scanSensitive(item, seen);
  }
  seen.delete(value);
}

function scanImportedUrl(value: unknown): void {
  if (typeof value !== 'string') return;
  let decoded = value;
  // URL components are bounded by import validation. Decode only a small,
  // fixed number of layers so percent-encoded credential labels cannot evade
  // the guard without turning this into an unbounded parser.
  for (let layer = 0; layer < 2; layer += 1) {
    let next: string;
    try { next = decodeURIComponent(decoded); } catch { break; }
    if (next === decoded) break;
    decoded = next;
  }
  if (containsAuditCredentials(value) || containsAuditCredentials(decoded)) serviceError(400, 'AUDIT_SENSITIVE_INPUT');
  let parsed: URL;
  try { parsed = new URL(value); } catch {
    // The import validator enforces bounded URL text but intentionally leaves
    // URL policy to this narrow credential guard; malformed text is not a
    // credential by itself.
    return;
  }
  if (parsed.username || parsed.password) serviceError(400, 'AUDIT_SENSITIVE_INPUT');
}

function scanImportedUserContent(record: AuditRecord): void {
  // Do not scan JSON.stringify(record): signed proof timestamps, generated
  // IDs, revisions and ISO dates are technical metadata, not owner input, and
  // numeric metadata can resemble a payment-card candidate.  The import
  // validator still rejects unknown/oversized technical structures separately.
  scanSensitive(record.title);
  for (const message of record.messages) {
    scanSensitive(message.content);
    if (message.suggestions) for (const suggestion of message.suggestions) scanSensitive(suggestion);
  }
  scanSensitive(record.report);
  if (record.assessment !== null) {
    scanSensitive(record.assessment.verdict);
    scanSensitive(record.assessment.product);
    scanSensitive(record.assessment.opportunity);
    scanSensitive(record.assessment.readiness);
    for (const evidence of record.assessment.evidence) scanSensitive(evidence);
  }
  if (record.pilot !== null) {
    for (const field of ['owner', 'metric', 'baseline', 'target', 'observed', 'stopRule'] as const) scanSensitive(record.pilot[field]);
  }
  const state = record.intakeState as unknown as Record<string, unknown> | null;
  if (!state) return;
  scanSensitive(state.focusQuote);
  if (state.facts && typeof state.facts === 'object' && !Array.isArray(state.facts)) {
    for (const item of Object.values(state.facts)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const fact = item as Record<string, unknown>;
      scanSensitive(fact.value);
      scanSensitive(fact.quote);
      if (fact.previous && typeof fact.previous === 'object' && !Array.isArray(fact.previous)) {
        const previous = fact.previous as Record<string, unknown>;
        scanSensitive(previous.value);
        scanSensitive(previous.quote);
      }
    }
  }
  if (Array.isArray(state.history)) {
    for (const item of state.history) {
      if (item && typeof item === 'object' && !Array.isArray(item)) scanSensitive((item as Record<string, unknown>).content);
    }
  }
  const publicScan = state.publicScan;
  if (publicScan && typeof publicScan === 'object' && !Array.isArray(publicScan)) {
    const scan = publicScan as Record<string, unknown>;
    if (Array.isArray(scan.sources)) {
      for (const source of scan.sources) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
        const item = source as Record<string, unknown>;
        scanImportedUrl(item.url);
        scanSensitive(item.title);
        scanSensitive(item.excerpt);
      }
    }
    if (Array.isArray(scan.observations)) {
      for (const observation of scan.observations) {
        if (observation && typeof observation === 'object' && !Array.isArray(observation)) scanSensitive((observation as Record<string, unknown>).quote);
      }
    }
  }
}

function engineState(record: AuditRecord): EngineIntakeState {
  if (record.intakeState === null) {
    return createIntakeState(record.language, record.mode);
  }
  return structuredClone(record.intakeState) as unknown as EngineIntakeState;
}

function safeInitialProof(state: EngineIntakeState): EngineIntakeState {
  try {
    return signState(state) as EngineIntakeState;
  } catch {
    serviceError(503, 'AUDIT_HISTORY_STATE_UNAVAILABLE');
  }
}

function verifiedState(record: AuditRecord, nowMillis = Date.now()): EngineIntakeState {
  if (record.intakeState === null) return safeInitialProof(engineState(record));
  const proof = checkAuditStateProof(record.intakeState, nowMillis);
  if (proof.status === 'expired') serviceError(410, 'AUDIT_HISTORY_STATE_EXPIRED');
  if (proof.status === 'invalid') serviceError(400, 'AUDIT_HISTORY_INVALID_STATE');
  if (proof.status === 'unavailable') serviceError(503, 'AUDIT_HISTORY_STATE_UNAVAILABLE');
  if (proof.status !== 'valid') serviceError(503, 'AUDIT_HISTORY_STATE_UNAVAILABLE');
  return proof.state as unknown as EngineIntakeState;
}

function messageId(): string {
  return `message-${randomUUID()}`;
}

function appendAssistantProjection(current: HistoryEnvelope, content: string, next: EngineIntakeState, suggestions: string[]): AuditRecord {
  const assistantStub = next.complete ? 'Audit report provided. The client may correct facts.' : content;
  const stateForRecord = structuredClone(next);
  stateForRecord.history.push({ role: 'assistant', content: assistantStub });
  const signed = signState(stateForRecord) as unknown as AuditRecord['intakeState'];
  const complete = next.complete;
  const report = complete ? buildFinalBrief(next, next.language) : null;
  const assessment = complete ? assess(next) : null;
  const revisingReport = current.record.report !== null || current.record.intakeState?.complete === true;
  return {
    ...structuredClone(current.record),
    messages: [
      ...current.record.messages,
      { id: messageId(), role: 'user', content: next.history.at(-1)?.content ?? '' },
      { id: messageId(), role: 'assistant', content: assistantStub, ...(suggestions.length > 0 ? { suggestions: [...suggestions] } : {}) },
    ],
    intakeState: signed,
    assessment,
    report,
    decision: revisingReport || !complete ? 'unreviewed' : current.record.decision,
    pilot: current.record.pilot,
  } as AuditRecord;
}

export type AuditHistoryService = Readonly<{
  create(principal: HistoryPrincipal, input: CreateHistoryInput): HistoryMutationResult;
  list(principal: HistoryPrincipal, cursor?: string): HistoryListResult;
  get(principal: HistoryPrincipal, id: string): HistoryEnvelope;
  update(principal: HistoryPrincipal, id: string, input: UpdateHistoryInput): HistoryMutationResult;
  remove(principal: HistoryPrincipal, id: string, input: { requestId: string; expectedGeneration: number; expectedRevision: number }): HistoryMutationResult;
  clear(principal: HistoryPrincipal, input: { requestId: string; expectedGeneration: number; confirmation: 'clear_audit_history' }): HistoryMutationResult;
  importArchive(principal: HistoryPrincipal, input: ImportHistoryInput): HistoryMutationResult;
  import(principal: HistoryPrincipal, input: ImportHistoryInput): HistoryMutationResult;
  turn(principal: HistoryPrincipal, id: string, input: { requestId: string; expectedGeneration: number; expectedRevision: number; content: string; finish?: boolean }): Promise<HistoryMutationResult>;
}>;

export function createAuditHistoryService(deps: AuditHistoryServiceDeps): AuditHistoryService {
  const extractor: AuditHistoryExtractor = deps.extractor ?? deps.extract ?? realExtract;

  const create = (principal: HistoryPrincipal, input: CreateHistoryInput): HistoryMutationResult => {
    const validated = validateOperationBody('create', input) as unknown as CreateHistoryInput;
    scanSensitive(validated.title);
    return deps.store.create(principal, validated);
  };

  const list = (principal: HistoryPrincipal, cursor?: string): HistoryListResult => deps.store.list(principal, cursor);
  const get = (principal: HistoryPrincipal, id: string): HistoryEnvelope => deps.store.get(principal, id);

  const update = (principal: HistoryPrincipal, id: string, input: UpdateHistoryInput): HistoryMutationResult => {
    const validated = validateOperationBody('update', input) as unknown as UpdateHistoryInput;
    scanSensitive(validated.title);
    scanSensitive(validated.pilot);
    return deps.store.update(principal, id, validated);
  };

  const remove = (principal: HistoryPrincipal, id: string, input: { requestId: string; expectedGeneration: number; expectedRevision: number }): HistoryMutationResult => {
    const validated = validateOperationBody('remove', input) as typeof input;
    return deps.store.remove(principal, id, validated);
  };

  const clear = (principal: HistoryPrincipal, input: { requestId: string; expectedGeneration: number; confirmation: 'clear_audit_history' }): HistoryMutationResult => {
    const validated = validateOperationBody('clear', input) as typeof input;
    return deps.store.clear(principal, validated);
  };

  const importArchive = (principal: HistoryPrincipal, input: ImportHistoryInput): HistoryMutationResult => {
    const validated = validateOperationBody('import', input) as unknown as ImportHistoryInput;
    validateImportedRecord(validated.record);
    scanImportedUserContent(validated.record);
    return deps.store.importArchive(principal, validated);
  };

  const turn = async (principal: HistoryPrincipal, id: string, input: { requestId: string; expectedGeneration: number; expectedRevision: number; content: string; finish?: boolean }): Promise<HistoryMutationResult> => {
    const validated = validateOperationBody('turn', input) as typeof input;
    scanSensitive(validated.content);
    const finish = validated.finish === true;
    const fingerprint = stableFingerprint({
      content: validated.content,
      finish,
      expectedGeneration: validated.expectedGeneration,
      expectedRevision: validated.expectedRevision,
    });
    const reserved = deps.store.reserveTurn(principal, id, {
      requestId: validated.requestId,
      expectedGeneration: validated.expectedGeneration,
      expectedRevision: validated.expectedRevision,
      fingerprint,
    });
    if (reserved.kind === 'replayed') {
      if (reserved.result.envelope === null) serviceError(410, 'AUDIT_HISTORY_DELETED');
      return reserved.result;
    }

    try {
      // Reservation precedes proof/turn-limit checks so a completed retry can
      // replay its receipt even after the current proof expires or the turn
      // limit is reached. Any rejected continuation releases this exact lease.
      if (reserved.envelope.trust !== 'provider') serviceError(409, 'AUDIT_HISTORY_UNTRUSTED');
      const state = verifiedState(reserved.envelope.record, deps.now?.() ?? Date.now());
      if (state.turn >= auditTurnLimit(state) + 6) serviceError(409, 'AUDIT_HISTORY_TURN_LIMIT');
      const extraction = finish ? EMPTY_EXTRACTION : await extractor(state, validated.content.trim(), false);
      const next = advanceAudit(state, validated.content.trim(), extraction, finish);
      const question = next.complete ? null : questionFor(next);
      const assistantContent = next.complete ? buildFinalBrief(next, next.language) : (question?.content ?? '');
      const record = appendAssistantProjection(reserved.envelope, assistantContent, next, question?.suggestions ?? []);
      return deps.store.commitTurn(principal, id, {
        requestId: validated.requestId,
        expectedGeneration: validated.expectedGeneration,
        expectedRevision: validated.expectedRevision,
        fence: reserved.lease.fence,
        record,
      });
    } catch (error) {
      try {
        deps.store.releaseTurn(principal, id, {
          requestId: validated.requestId,
          expectedGeneration: validated.expectedGeneration,
          fence: reserved.lease.fence,
        });
      } catch {
        // A delete/clear/reclaim may have already fenced this lease. Preserve
        // the original failure and never turn it into a successful response.
      }
      if (error instanceof AuditHistoryServiceError || error instanceof HistoryError) throw error;
      serviceError(503, 'AUDIT_HISTORY_MODEL_FAILURE');
    }
  };

  return Object.freeze({ create, list, get, update, remove, clear, importArchive, import: importArchive, turn });
}
