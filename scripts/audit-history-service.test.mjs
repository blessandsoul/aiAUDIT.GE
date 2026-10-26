import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { HistoryStore } from '../src/lib/audit-history/store.ts';
import { createAuditHistoryService } from '../src/lib/audit-history/service.ts';
import { createIntakeState } from '../src/lib/audit-engine.ts';
import { signState } from '../src/lib/audit-session.ts';

const owner = Object.freeze({ userId: 'user-one', accountId: 'account-one' });
const key = new Uint8Array(32).fill(0x44);
const extraction = { focus: 'discovery', focusEvidence: '', updates: [], nextField: null };

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aiaudit-history-service-'));
  process.env.AUDIT_SESSION_SECRET = 'service-test-session-secret-2026';
  const store = new HistoryStore({ path: path.join(directory, 'history.sqlite'), keyring: { activeKeyId: 'active', keys: new Map([['active', key]]) }, retention: 'owner_delete' });
  return { directory, store };
}

function create(service, id = 'case-one') {
  return service.create(owner, { requestId: `create-${id}`, expectedGeneration: 1, id, title: 'Case', mode: 'quick', language: 'en' });
}

test('service uses real SQLite and engine/report behavior while fixture extraction remains injected', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let extractionCalls = 0;
  const service = createAuditHistoryService({
    store: fx.store,
    extractor: async () => { extractionCalls += 1; return extraction; },
  });
  const created = create(service);
  assert.equal(created.envelope.record.intakeState, null);
  const turned = await service.turn(owner, 'case-one', {
    requestId: 'turn-one', expectedGeneration: 1, expectedRevision: 1, content: 'The business is a small store.', finish: true,
  });
  assert.equal(extractionCalls, 0);
  assert.equal(turned.receipt.operation, 'turn');
  assert.equal(turned.envelope.record.intakeState.complete, true);
  assert.equal(typeof turned.envelope.record.report, 'string');
  assert.ok(turned.envelope.record.assessment);
  assert.equal(turned.envelope.record.intakeState.history.at(-1).role, 'assistant');
  assert.equal(turned.envelope.record.intakeState.history.at(-1).content, 'Audit report provided. The client may correct facts.');
  const replay = await service.turn(owner, 'case-one', {
    requestId: 'turn-one', expectedGeneration: 1, expectedRevision: 1, content: 'The business is a small store.', finish: true,
  });
  assert.equal(extractionCalls, 0);
  assert.deepEqual(replay.receipt, turned.receipt);
  assert.equal(replay.envelope.record.id, 'case-one');
});

test('service rejects imported records for continuation and scans sensitive title/pilot/turn input', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => extraction });
  const imported = service.importArchive(owner, {
    requestId: 'import-one', expectedGeneration: 1,
    record: { id: 'old', title: 'Imported', mode: 'quick', language: 'en', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', messages: [], intakeState: null, assessment: null, report: 'Historical', decision: 'unreviewed', pilot: null },
  });
  await assert.rejects(service.turn(owner, imported.receipt.id, { requestId: 'turn-import', expectedGeneration: 1, expectedRevision: 1, content: 'continue', finish: true }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'AUDIT_HISTORY_UNTRUSTED');
    return true;
  });
  await assert.rejects(Promise.resolve().then(() => service.create(owner, { requestId: 'bad-title', expectedGeneration: 1, id: 'bad-title', title: 'api_key: hidden-secret', mode: 'quick', language: 'en' })), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'AUDIT_SENSITIVE_INPUT');
    return true;
  });
});

test('import scanning ignores proof, timestamps and generated numeric IDs but blocks secrets in user content', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => extraction });
  const benign = {
    id: '4111111111111111', title: 'Numeric metadata is not owner input', mode: 'quick', language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [{ id: '4111111111111111', role: 'user', content: 'We handle ordinary orders.' }],
    intakeState: {
      version: 2, mode: 'quick', turn: 1, language: 'en', focus: 'discovery', focusQuote: 'ordinary orders',
      facts: {}, asked: {}, currentQuestion: null, complete: false, stopReason: null,
      history: [{ role: 'user', content: 'We handle ordinary orders.' }], proof: '1800000000000.' + '0'.repeat(64),
    },
    assessment: null, report: null, decision: 'unreviewed', pilot: null,
  };
  const imported = service.importArchive(owner, { requestId: 'import-benign', expectedGeneration: 1, record: benign });
  assert.equal(imported.envelope.trust, 'imported_unverified');
  await assert.rejects(Promise.resolve().then(() => service.importArchive(owner, {
    requestId: 'import-secret', expectedGeneration: 1,
    record: { ...benign, id: 'secret-case', messages: [{ ...benign.messages[0], id: 'message-2', content: 'api_key: hidden-secret-value' }] },
  })), (error) => {
    assert.equal(error.status, 400);
    assert.equal(error.code, 'AUDIT_SENSITIVE_INPUT');
    return true;
  });
});

test('import scanning covers suggestions, assessment strings and public-source text without scanning technical metadata', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => extraction });
  const base = {
    id: 'technical-4111111111111111', title: 'Safe title', mode: 'quick', language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [{ id: 'message-4111111111111111', role: 'user', content: 'Safe message', suggestions: ['Safe suggestion'] }],
    intakeState: {
      version: 2, mode: 'quick', turn: 1, language: 'en', focus: 'discovery', focusQuote: 'Safe focus',
      facts: {}, asked: {}, currentQuestion: null, complete: false, stopReason: null,
      history: [{ role: 'user', content: 'Safe history' }], proof: '1800000000000.' + '0'.repeat(64),
      publicScan: {
        sources: [{ id: 'source-4111111111111111', url: 'https://example.test/4111111111111111', checkedAt: '2026-01-01T00:00:00.000Z', status: 'read', title: 'Safe source title', excerpt: 'Safe source excerpt' }],
        observations: [{ sourceId: 'source-4111111111111111', kind: 'business', quote: 'Safe source observation' }],
        aiStatus: 'reviewed',
      },
    },
    assessment: { verdict: 'Safe verdict', product: null, opportunity: 'Safe opportunity', readiness: 'Safe readiness', evidence: ['Safe evidence'] },
    report: 'Safe report', decision: 'unreviewed', pilot: null,
  };
  assert.equal(service.importArchive(owner, { requestId: 'import-rich-safe', expectedGeneration: 1, record: base }).envelope.trust, 'imported_unverified');
  const cases = [
    ['suggestion', { ...base, messages: [{ ...base.messages[0], suggestions: ['api_key: hidden-secret-value'] }] }],
    ['assessment', { ...base, assessment: { ...base.assessment, verdict: 'api_key: hidden-secret-value' } }],
    ['url-query', { ...base, intakeState: { ...base.intakeState, publicScan: { ...base.intakeState.publicScan, sources: [{ ...base.intakeState.publicScan.sources[0], url: 'https://example.test/?api_key=hidden-secret-value' }] } } }],
    ['url-percent-query', { ...base, intakeState: { ...base.intakeState, publicScan: { ...base.intakeState.publicScan, sources: [{ ...base.intakeState.publicScan.sources[0], url: 'https://example.test/?api%5Fkey=hidden-secret-value' }] } } }],
    ['url-userinfo', { ...base, intakeState: { ...base.intakeState, publicScan: { ...base.intakeState.publicScan, sources: [{ ...base.intakeState.publicScan.sources[0], url: 'https://user:secret@example.test/path' }] } } }],
    ['public-title', { ...base, intakeState: { ...base.intakeState, publicScan: { ...base.intakeState.publicScan, sources: [{ ...base.intakeState.publicScan.sources[0], title: 'api_key: hidden-secret-value' }] } } }],
    ['public-observation', { ...base, intakeState: { ...base.intakeState, publicScan: { ...base.intakeState.publicScan, observations: [{ ...base.intakeState.publicScan.observations[0], quote: 'api_key: hidden-secret-value' }] } } }],
  ];
  for (const [name, record] of cases) {
    await assert.rejects(Promise.resolve().then(() => service.importArchive(owner, { requestId: `import-rich-${name}`, expectedGeneration: 1, record })), (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'AUDIT_SENSITIVE_INPUT');
      return true;
    }, name);
  }
});

test('missing signing configuration fails before extractor admission, and extractor failure releases the exact turn lease for retry', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let calls = 0;
  const service = createAuditHistoryService({
    store: fx.store,
    extractor: async () => { calls += 1; if (calls === 1) throw new Error('fixture extractor failure'); return extraction; },
  });
  create(service);
  const secret = process.env.AUDIT_SESSION_SECRET;
  delete process.env.AUDIT_SESSION_SECRET;
  await assert.rejects(service.turn(owner, 'case-one', { requestId: 'turn-signing', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: true }), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'AUDIT_HISTORY_STATE_UNAVAILABLE');
    return true;
  });
  assert.equal(calls, 0);
  process.env.AUDIT_SESSION_SECRET = secret;
  await assert.rejects(service.turn(owner, 'case-one', { requestId: 'turn-retry', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: false }), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'AUDIT_HISTORY_MODEL_FAILURE');
    return true;
  });
  const retry = await service.turn(owner, 'case-one', { requestId: 'turn-signing', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: true });
  assert.equal(calls, 1);
  assert.equal(retry.receipt.operation, 'turn');
});

test('long turn intents use bounded hashes and distinguish changed one-thousand/three-thousand-character retries', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let calls = 0;
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => { calls += 1; return extraction; } });
  create(service);
  const oneThousand = 'a'.repeat(1_000);
  const threeThousand = 'b'.repeat(3_000);
  await service.turn(owner, 'case-one', { requestId: 'long-turn', expectedGeneration: 1, expectedRevision: 1, content: oneThousand, finish: false });
  assert.equal(calls, 1);
  const replay = await service.turn(owner, 'case-one', { requestId: 'long-turn', expectedGeneration: 1, expectedRevision: 1, content: oneThousand, finish: false });
  assert.equal(replay.receipt.operation, 'turn');
  assert.equal(calls, 1);
  await assert.rejects(service.turn(owner, 'case-one', { requestId: 'long-turn', expectedGeneration: 1, expectedRevision: 1, content: threeThousand, finish: false }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT');
    return true;
  });
  assert.equal(calls, 1);
});

test('a completed retry replays after its signed proof expires without extractor or proof preflight', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let calls = 0;
  let logicalNow = 1_800_000_000_000;
  const service = createAuditHistoryService({ store: fx.store, now: () => logicalNow, extractor: async () => { calls += 1; return extraction; } });
  create(service);
  const originalNow = Date.now;
  Date.now = () => logicalNow;
  try {
    await service.turn(owner, 'case-one', { requestId: 'expired-replay', expectedGeneration: 1, expectedRevision: 1, content: 'completed answer', finish: true });
  } finally {
    Date.now = originalNow;
  }
  logicalNow += 12 * 60 * 60 * 1000 + 1;
  const replay = await service.turn(owner, 'case-one', { requestId: 'expired-replay', expectedGeneration: 1, expectedRevision: 1, content: 'completed answer', finish: true });
  assert.equal(replay.receipt.operation, 'turn');
  assert.equal(calls, 0);
});

test('turn-limit rejection occurs after reservation, releases the lease, and never calls the extractor', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let calls = 0;
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => { calls += 1; return extraction; } });
  create(service);
  const seeded = fx.store.get(owner, 'case-one');
  const reserved = fx.store.reserveTurn(owner, 'case-one', { requestId: 'seed-high-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'seed-high-turn' });
  assert.equal(reserved.kind, 'reserved');
  const highTurn = createIntakeState('en', 'quick');
  highTurn.turn = 30;
  highTurn.currentQuestion = 'business';
  const signed = signState(highTurn);
  fx.store.commitTurn(owner, 'case-one', {
    requestId: 'seed-high-turn', expectedGeneration: 1, expectedRevision: 1, fence: reserved.lease.fence,
    record: { ...seeded.record, intakeState: signed, messages: [], report: null, assessment: null },
  });
  await assert.rejects(service.turn(owner, 'case-one', { requestId: 'limit-turn', expectedGeneration: 1, expectedRevision: 2, content: 'answer', finish: false }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, 'AUDIT_HISTORY_TURN_LIMIT');
    return true;
  });
  assert.equal(calls, 0);
  const retry = await service.turn(owner, 'case-one', { requestId: 'limit-turn', expectedGeneration: 1, expectedRevision: 2, content: 'answer', finish: false }).catch((error) => error);
  assert.equal(retry.code, 'AUDIT_HISTORY_TURN_LIMIT');
});

test('deletion while extraction is pending wins over a late model result', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => { await pending; return extraction; } });
  create(service);
  const turn = service.turn(owner, 'case-one', { requestId: 'turn-pending', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: false });
  await new Promise((resolve) => setImmediate(resolve));
  const removed = service.remove(owner, 'case-one', { requestId: 'remove-case', expectedGeneration: 1, expectedRevision: 1 });
  assert.equal(removed.envelope, null);
  release();
  await assert.rejects(turn, (error) => { assert.equal(error.status, 410); return true; });
});

test('a completed turn retry after deletion returns deleted without re-extracting', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let extractionCalls = 0;
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => { extractionCalls += 1; return extraction; } });
  create(service);
  const completedTurn = await service.turn(owner, 'case-one', { requestId: 'turn-delete-retry', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: false });
  assert.equal(completedTurn.receipt.operation, 'turn');
  assert.equal(extractionCalls, 1);
  service.remove(owner, 'case-one', { requestId: 'remove-before-retry', expectedGeneration: 1, expectedRevision: completedTurn.envelope.revision });
  await assert.rejects(service.turn(owner, 'case-one', { requestId: 'turn-delete-retry', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: false }), (error) => {
    assert.equal(error.status, 410);
    assert.equal(error.code, 'AUDIT_HISTORY_DELETED');
    return true;
  });
  assert.equal(extractionCalls, 1);
});

test('correction reopens a completed audit, clears the current recommendation, and preserves the historical report', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => extraction });
  create(service);
  const first = await service.turn(owner, 'case-one', { requestId: 'turn-complete', expectedGeneration: 1, expectedRevision: 1, content: 'first answer', finish: true });
  assert.equal(first.envelope.record.report !== null, true);
  const decided = service.update(owner, 'case-one', { requestId: 'decision-one', expectedGeneration: 1, expectedRevision: first.envelope.revision, decision: 'defer' });
  const reopened = await service.turn(owner, 'case-one', { requestId: 'turn-correction', expectedGeneration: 1, expectedRevision: decided.envelope.revision, content: 'corrected answer', finish: false });
  assert.equal(reopened.envelope.record.report, null);
  assert.equal(reopened.envelope.record.assessment, null);
  assert.equal(reopened.envelope.record.decision, 'unreviewed');
  assert.equal(reopened.envelope.reportRevisions.length, 1);
  assert.equal(reopened.envelope.reportRevisions[0].report, first.envelope.record.report);
});

test('expired signed state remains readable as an archive but cannot continue', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => extraction, now: () => 1_800_000_000_000 + 12 * 60 * 60 * 1000 + 1 });
  create(service);
  const originalNow = Date.now;
  Date.now = () => 1_800_000_000_000;
  let first;
  try {
    first = await service.turn(owner, 'case-one', { requestId: 'turn-old', expectedGeneration: 1, expectedRevision: 1, content: 'old answer', finish: true });
  } finally {
    Date.now = originalNow;
  }
  const archive = service.get(owner, 'case-one');
  assert.equal(archive.revision, first.envelope.revision);
  await assert.rejects(service.turn(owner, 'case-one', { requestId: 'turn-expired', expectedGeneration: 1, expectedRevision: archive.revision, content: 'continue', finish: true }), (error) => {
    assert.equal(error.status, 410);
    assert.equal(error.code, 'AUDIT_HISTORY_STATE_EXPIRED');
    return true;
  });
});

test('clear during pending extraction prevents a late commit from resurrecting the record', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = createAuditHistoryService({ store: fx.store, extractor: async () => { await pending; return extraction; } });
  create(service);
  const turn = service.turn(owner, 'case-one', { requestId: 'turn-clear-pending', expectedGeneration: 1, expectedRevision: 1, content: 'answer', finish: false });
  await new Promise((resolve) => setImmediate(resolve));
  const cleared = service.clear(owner, { requestId: 'clear-pending', expectedGeneration: 1, confirmation: 'clear_audit_history' });
  assert.equal(cleared.receipt.generation, 2);
  release();
  await assert.rejects(turn, (error) => { assert.equal(error.status, 409); return true; });
  assert.throws(() => service.get(owner, 'case-one'), (error) => { assert.equal(error.status, 404); return true; });
});
