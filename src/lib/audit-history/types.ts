export type AuditMode = 'quick' | 'deep';
export type AuditLanguage = 'ka' | 'ru' | 'en';

export type IntakeMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/**
 * Provider-owned shape of the signed intake state.  The provider keeps the
 * engine's state opaque beyond the fields that are bounded by the store.
 * Keeping this type here avoids importing a client module into the provider.
 */
export type IntakeState = {
  version: number;
  turn: number;
  language: AuditLanguage;
  mode?: AuditMode;
  focus: string;
  facts: Record<string, unknown>;
  currentQuestion: string | null;
  complete: boolean;
  proof?: string | null;
  history: IntakeMessage[];
  asked: Record<string, number>;
  [key: string]: unknown;
};

export type Assessment = {
  verdict: string;
  product: string | null;
  opportunity: string;
  readiness: string;
  evidence: string[];
};

// Compatibility aliases for the engine-facing vocabulary used by the client;
// these remain provider-owned type aliases and do not import client runtime.
export type AuditIntakeState = IntakeState;
export type AuditAssessment = Assessment;

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
};

export type Pilot = {
  owner: string;
  metric: string;
  baseline: string;
  target: string;
  observed: string;
  stopRule: string;
  status: 'draft' | 'measuring' | 'review' | 'completed';
};

export type AuditRecord = {
  id: string;
  title: string;
  mode: AuditMode;
  language: AuditLanguage;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  intakeState: IntakeState | null;
  assessment: Assessment | null;
  report: string | null;
  decision: 'unreviewed' | 'prepare' | 'defer';
  pilot: Pilot | null;
};

export type HistoryPrincipal = Readonly<{
  userId: string;
  accountId: string;
}>;

export type ReportRevision = {
  revision: number;
  createdAt: string;
  report: string;
  assessment: Assessment | null;
};

export type HistoryEnvelope = {
  schemaVersion: 1;
  revision: number;
  generation: number;
  trust: 'provider' | 'imported_unverified';
  record: AuditRecord;
  reportRevisions: ReportRevision[];
};

export type HistoryReceipt = {
  requestId: string;
  operation: string;
  id: string | null;
  generation: number;
  committedRevision: number | null;
};

export type HistoryMutationResult = {
  receipt: HistoryReceipt;
  envelope: HistoryEnvelope | null;
};

export type HistoryListResult = {
  generation: number;
  items: HistoryEnvelope[];
  nextCursor: string | null;
};

export type HistoryErrorCode = string;

const SAFE_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  AUDIT_HISTORY_INVALID_INPUT: 'Invalid audit history request',
  AUDIT_HISTORY_NOT_FOUND: 'Audit history not found',
  AUDIT_HISTORY_DELETED: 'Audit history has been deleted',
  AUDIT_HISTORY_EXPIRED: 'Audit history has expired',
  AUDIT_HISTORY_GENERATION_CONFLICT: 'Audit history generation conflict',
  AUDIT_HISTORY_REVISION_CONFLICT: 'Audit history revision conflict',
  AUDIT_HISTORY_IDEMPOTENCY_CONFLICT: 'Audit history request conflict',
  AUDIT_HISTORY_ID_EXISTS: 'Audit history case already exists',
  AUDIT_HISTORY_CAPACITY: 'Audit history capacity is unavailable',
  AUDIT_HISTORY_KEY_FAILURE: 'Audit history encryption is unavailable',
  AUDIT_HISTORY_STORAGE_FAILURE: 'Audit history storage is unavailable',
  AUDIT_HISTORY_UNAVAILABLE: 'Audit history is unavailable',
  AUDIT_HISTORY_UNTRUSTED: 'Imported audit history cannot continue',
  AUDIT_TURN_BUSY: 'Audit turn is already in progress',
  AUDIT_HISTORY_TURN_FENCE_INVALID: 'Audit turn lease is no longer valid',
});

/**
 * Public-safe error.  The constructor intentionally accepts only a status and
 * code so SQL, key material, paths, and payloads cannot escape in a message.
 */
export class HistoryError extends Error {
  readonly status: number;
  readonly code: HistoryErrorCode;

  constructor(status: number, code: HistoryErrorCode) {
    super(SAFE_MESSAGES[code] ?? SAFE_MESSAGES.AUDIT_HISTORY_UNAVAILABLE);
    this.name = 'HistoryError';
    this.status = status;
    this.code = code;
  }
}

export type HistoryKeyring = {
  activeKeyId: string;
  keys: ReadonlyMap<string, Uint8Array>;
};

export type HistoryRetention = 'owner_delete' | { days: 90 | 365 };

export type HistoryStoreOptions = {
  path: string;
  keyring: HistoryKeyring;
  retention: HistoryRetention;
  now?: () => number;
};

export type CreateHistoryInput = {
  requestId: string;
  expectedGeneration: number;
  id: string;
  title: string;
  mode: AuditMode;
  language: AuditLanguage;
};

export type UpdateHistoryInput = {
  requestId: string;
  expectedGeneration: number;
  expectedRevision: number;
  title?: string;
  decision?: AuditRecord['decision'];
  pilot?: Pilot | null;
};

export type RemoveHistoryInput = {
  requestId: string;
  expectedGeneration: number;
  expectedRevision: number;
};

export type ClearHistoryInput = {
  requestId: string;
  expectedGeneration: number;
  confirmation: 'clear_audit_history';
};

export type ImportHistoryInput = {
  requestId: string;
  expectedGeneration: number;
  record: AuditRecord;
};

export type ReserveTurnInput = {
  requestId: string;
  expectedGeneration: number;
  expectedRevision: number;
  fingerprint: string;
};

export type ReservedTurn = {
  kind: 'reserved';
  envelope: HistoryEnvelope;
  lease: {
    fence: string;
    expiresAt: number;
  };
};

export type ReplayedTurn = {
  kind: 'replayed';
  result: HistoryMutationResult;
};

export type ReserveTurnResult = ReservedTurn | ReplayedTurn;

export type CommitTurnInput = {
  requestId: string;
  expectedGeneration: number;
  expectedRevision: number;
  fence: string;
  record: AuditRecord;
};

export type ReleaseTurnInput = {
  requestId: string;
  expectedGeneration: number;
  fence: string;
};
