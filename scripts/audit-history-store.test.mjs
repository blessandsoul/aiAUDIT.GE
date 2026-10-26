import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, mkdtemp, rm, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const { HistoryStore } = await import('../src/lib/audit-history/store.ts');
const { HistoryError } = await import('../src/lib/audit-history/types.ts');
const { createIntakeState } = await import('../src/lib/audit-engine.ts');
const { signState, verifyState } = await import('../src/lib/audit-session.ts');

const owner = Object.freeze({ userId: 'user-one', accountId: 'account-one' });
const otherOwner = Object.freeze({ userId: 'user-two', accountId: 'account-two' });
const keyOne = new Uint8Array(32).fill(0x11);
const keyTwo = new Uint8Array(32).fill(0x22);

function keyring(activeKeyId = 'k-one', includeOld = true) {
  return {
    activeKeyId,
    keys: new Map([
      ...(includeOld ? [['k-one', keyOne]] : []),
      ...(activeKeyId === 'k-two' ? [['k-two', keyTwo]] : []),
    ]),
  };
}

function expectError(fn, code, status) {
  assert.throws(fn, (error) => error instanceof HistoryError && error.code === code && (status === undefined || error.status === status));
}

function importedRecord(overrides = {}) {
  return {
    id: 'local-case-id',
    title: 'Imported case',
    mode: 'quick',
    language: 'ka',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [{ id: 'm1', role: 'user', content: 'Imported transcript' }],
    intakeState: null,
    assessment: null,
    report: 'Imported report',
    decision: 'unreviewed',
    pilot: null,
    ...overrides,
  };
}

function committedRecord(overrides = {}) {
  return importedRecord({
    id: 'model-generated-id-must-not-win',
    createdAt: '1999-01-01T00:00:00.000Z',
    updatedAt: '1999-01-01T00:00:00.000Z',
    messages: [
      { id: 'user-message', role: 'user', content: 'A real answer' },
      { id: 'assistant-message', role: 'assistant', content: 'A useful next question', suggestions: ['Continue'] },
    ],
    report: 'Current provider report',
    ...overrides,
  });
}

async function fixture(retention = 'owner_delete', initialNow = Date.parse('2026-01-01T00:00:00.000Z')) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aiaudit-history-store-'));
  const dbPath = path.join(directory, 'history.sqlite');
  let clock = initialNow;
  const store = new HistoryStore({ path: dbPath, keyring: keyring(), retention, now: () => clock });
  return {
    directory,
    dbPath,
    now(value) { clock = value; },
    advance(milliseconds) { clock += milliseconds; },
    store,
    async cleanup() {
      store.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test('creates, lists, and isolates full encrypted records across two real connections', async () => {
  const fx = await fixture();
  const secondConnection = new HistoryStore({ path: fx.dbPath, keyring: keyring(), now: () => Date.parse('2026-01-01T00:00:01.000Z'), retention: 'owner_delete' });
  try {
    const created = fx.store.create(owner, {
      requestId: 'create-one', expectedGeneration: 1, id: 'case-one', title: 'Secret business', mode: 'quick', language: 'ka',
    });
    assert.equal(created.envelope?.revision, 1);
    assert.equal(created.envelope?.generation, 1);
    assert.equal(created.envelope?.trust, 'provider');
    assert.equal(secondConnection.get(owner, 'case-one').record.title, 'Secret business');
    assert.equal(fx.store.list(owner).items.length, 1);
    assert.equal(fx.store.list(otherOwner).items.length, 0);
    expectError(() => secondConnection.get(otherOwner, 'case-one'), 'AUDIT_HISTORY_NOT_FOUND', 404);

    const bytes = await readFile(fx.dbPath);
    assert.ok(!bytes.includes(Buffer.from('Secret business')));
    assert.ok(!bytes.includes(Buffer.from('create-one')));
  } finally {
    secondConnection.close();
    await fx.cleanup();
  }
});

test('reopens persisted data and reads with an old key while writing with a rotated active key', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'create-rotation', expectedGeneration: 1, id: 'rotation-case', title: 'Before rotation', mode: 'deep', language: 'en' });
    fx.store.close();
    const rotated = new HistoryStore({ path: fx.dbPath, keyring: keyring('k-two'), retention: 'owner_delete', now: () => Date.parse('2026-01-01T00:00:02.000Z') });
    try {
      assert.equal(rotated.get(owner, 'rotation-case').record.title, 'Before rotation');
      const updated = rotated.update(owner, 'rotation-case', { requestId: 'update-rotation', expectedGeneration: 1, expectedRevision: 1, title: 'After rotation' });
      assert.equal(updated.envelope?.record.title, 'After rotation');
    } finally {
      rotated.close();
    }
    const reopened = new HistoryStore({ path: fx.dbPath, keyring: keyring('k-two'), retention: 'owner_delete', now: () => Date.parse('2026-01-01T00:00:03.000Z') });
    try {
      assert.equal(reopened.get(owner, 'rotation-case').record.title, 'After rotation');
    } finally {
      reopened.close();
    }
  } finally {
    if (!fx.store.closed) fx.store.close();
    await fx.cleanup();
  }
});

test('preserves signed intake JSON order and omitted optionals through commit, update, and reopen', async () => {
  process.env.AUDIT_SESSION_SECRET = 'provider-history-roundtrip-test-secret';
  const fx = await fixture();
  try {
    const signed = signState(createIntakeState('ka'));
    signed.optionalProof = undefined;
    assert.equal(verifyState(signed), true);
    fx.store.create(owner, { requestId: 'signed-create', expectedGeneration: 1, id: 'signed-case', title: 'Signed state', mode: 'quick', language: 'ka' });
    const lease = fx.store.reserveTurn(owner, 'signed-case', { requestId: 'signed-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'signed-input' });
    const committed = fx.store.commitTurn(owner, 'signed-case', {
      requestId: 'signed-turn',
      expectedGeneration: 1,
      expectedRevision: 1,
      fence: lease.lease.fence,
      record: committedRecord({
        intakeState: signed,
        messages: [{ id: 'message-without-suggestions', role: 'assistant', content: 'Readable' }, { id: 'message-with-undefined', role: 'user', content: 'Optional', suggestions: undefined }],
      }),
    });
    assert.equal(verifyState(committed.envelope.record.intakeState), true);
    assert.equal(committed.envelope.record.intakeState.optionalProof, undefined);
    assert.equal(committed.envelope.record.messages[1].suggestions, undefined);
    const updated = fx.store.update(owner, 'signed-case', { requestId: 'signed-update', expectedGeneration: 1, expectedRevision: 2, title: 'Signed state updated' });
    assert.equal(verifyState(updated.envelope.record.intakeState), true);
    fx.store.close();
    const reopened = new HistoryStore({ path: fx.dbPath, keyring: keyring(), retention: 'owner_delete', now: () => Date.parse('2026-01-01T00:00:03.000Z') });
    try {
      const readback = reopened.get(owner, 'signed-case');
      assert.equal(verifyState(readback.record.intakeState), true);
      assert.equal(readback.record.intakeState.optionalProof, undefined);
      assert.equal(readback.record.messages[1].suggestions, undefined);
    } finally {
      reopened.close();
    }
  } finally {
    if (!fx.store.closed) fx.store.close();
    await fx.cleanup();
  }
});

test('enforces CAS and idempotency while returning the current envelope on replay', async () => {
  const fx = await fixture();
  try {
    const first = fx.store.create(owner, { requestId: 'create-idempotent', expectedGeneration: 1, id: 'cas-case', title: 'Original', mode: 'quick', language: 'ru' });
    const replay = fx.store.create(owner, { requestId: 'create-idempotent', expectedGeneration: 1, id: 'cas-case', title: 'Original', mode: 'quick', language: 'ru' });
    assert.deepEqual(replay.receipt, first.receipt);
    assert.equal(replay.envelope?.record.title, 'Original');
    expectError(() => fx.store.create(owner, { requestId: 'create-idempotent', expectedGeneration: 1, id: 'cas-case', title: 'Changed body', mode: 'quick', language: 'ru' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    expectError(() => fx.store.update(owner, 'cas-case', { requestId: 'update-stale', expectedGeneration: 1, expectedRevision: 9, title: 'Nope' }), 'AUDIT_HISTORY_REVISION_CONFLICT', 409);
    const update = fx.store.update(owner, 'cas-case', { requestId: 'update-one', expectedGeneration: 1, expectedRevision: 1, title: 'Owner correction', decision: 'prepare' });
    assert.equal(update.envelope?.revision, 2);
    const updateReplay = fx.store.update(owner, 'cas-case', { requestId: 'update-one', expectedGeneration: 1, expectedRevision: 1, title: 'Owner correction', decision: 'prepare' });
    assert.equal(updateReplay.receipt.committedRevision, 2);
    assert.equal(updateReplay.envelope?.revision, 2);
    assert.equal(fx.store.get(owner, 'cas-case').record.title, 'Owner correction');
  } finally {
    await fx.cleanup();
  }
});

test('clears one generation, permits the same case id only in the new generation, and makes old clear retry content-free', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'create-before-clear', expectedGeneration: 1, id: 'reusable-case', title: 'Old payload', mode: 'quick', language: 'ka' });
    const cleared = fx.store.clear(owner, { requestId: 'clear-one', expectedGeneration: 1, confirmation: 'clear_audit_history' });
    assert.equal(cleared.receipt.generation, 2);
    assert.equal(cleared.envelope, null);
    const clearReplay = fx.store.clear(owner, { requestId: 'clear-one', expectedGeneration: 1, confirmation: 'clear_audit_history' });
    assert.deepEqual(clearReplay.receipt, cleared.receipt);
    assert.equal(clearReplay.envelope, null);
    expectError(() => fx.store.clear(owner, { requestId: 'clear-old-body', expectedGeneration: 1, confirmation: 'clear_audit_history' }), 'AUDIT_HISTORY_GENERATION_CONFLICT', 409);
    const recreated = fx.store.create(owner, { requestId: 'create-after-clear', expectedGeneration: 2, id: 'reusable-case', title: 'New generation payload', mode: 'quick', language: 'ka' });
    assert.equal(recreated.envelope?.generation, 2);
    assert.equal(fx.store.get(owner, 'reusable-case').record.title, 'New generation payload');
    const afterReplay = fx.store.clear(owner, { requestId: 'clear-one', expectedGeneration: 1, confirmation: 'clear_audit_history' });
    assert.equal(afterReplay.envelope, null);
    assert.equal(fx.store.get(owner, 'reusable-case').record.title, 'New generation payload');
  } finally {
    await fx.cleanup();
  }
});

test('deletion wins over a pending lease and an expired lease gets a new fence', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'create-turn', expectedGeneration: 1, id: 'turn-case', title: 'Turn', mode: 'quick', language: 'ka' });
    const lease = fx.store.reserveTurn(owner, 'turn-case', { requestId: 'turn-one', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'input-one' });
    assert.equal(lease.kind, 'reserved');
    const removed = fx.store.remove(owner, 'turn-case', { requestId: 'remove-during-turn', expectedGeneration: 1, expectedRevision: 1 });
    assert.equal(removed.envelope, null);
    expectError(() => fx.store.commitTurn(owner, 'turn-case', { requestId: 'turn-one', expectedGeneration: 1, expectedRevision: 1, fence: lease.lease.fence, record: committedRecord() }), 'AUDIT_HISTORY_DELETED', 410);
    expectError(() => fx.store.get(owner, 'turn-case'), 'AUDIT_HISTORY_DELETED', 410);

    fx.store.create(owner, { requestId: 'create-expiring-turn', expectedGeneration: 1, id: 'expiring-case', title: 'Expiry', mode: 'quick', language: 'ka' });
    const firstLease = fx.store.reserveTurn(owner, 'expiring-case', { requestId: 'turn-expiring', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'input-two' });
    expectError(() => fx.store.reserveTurn(owner, 'expiring-case', { requestId: 'turn-expiring', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'input-two' }), 'AUDIT_TURN_BUSY', 409);
    fx.advance(90_001);
    const reclaimed = fx.store.reserveTurn(owner, 'expiring-case', { requestId: 'turn-expiring', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'input-two' });
    assert.equal(reclaimed.kind, 'reserved');
    assert.notEqual(reclaimed.lease.fence, firstLease.lease.fence);
    expectError(() => fx.store.commitTurn(owner, 'expiring-case', { requestId: 'turn-expiring', expectedGeneration: 1, expectedRevision: 1, fence: firstLease.lease.fence, record: committedRecord() }), 'AUDIT_HISTORY_TURN_FENCE_INVALID', 409);
    const committed = fx.store.commitTurn(owner, 'expiring-case', { requestId: 'turn-expiring', expectedGeneration: 1, expectedRevision: 1, fence: reclaimed.lease.fence, record: committedRecord() });
    assert.equal(committed.envelope?.revision, 2);
    assert.equal(committed.envelope?.record.id, 'expiring-case');
    assert.equal(committed.envelope?.record.createdAt, fx.store.get(owner, 'expiring-case').record.createdAt);
  } finally {
    await fx.cleanup();
  }
});

test('keeps a released turn intent retryable without making release a competing operation', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'release-create', expectedGeneration: 1, id: 'release-case', title: 'Release', mode: 'quick', language: 'ka' });
    const first = fx.store.reserveTurn(owner, 'release-case', { requestId: 'reusable-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'same-input' });
    fx.store.releaseTurn(owner, 'release-case', { requestId: 'reusable-turn', expectedGeneration: 1, fence: first.lease.fence });
    const second = fx.store.reserveTurn(owner, 'release-case', { requestId: 'reusable-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'same-input' });
    assert.equal(second.kind, 'reserved');
    assert.notEqual(second.lease.fence, first.lease.fence);
    expectError(() => fx.store.reserveTurn(owner, 'release-case', { requestId: 'reusable-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'changed-input' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
  } finally {
    await fx.cleanup();
  }
});

test('retains expired turn intent binding across fence reclaim', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'intent-create', expectedGeneration: 1, id: 'intent-case', title: 'Intent', mode: 'quick', language: 'ka' });
    const first = fx.store.reserveTurn(owner, 'intent-case', { requestId: 'intent-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'intent-body' });
    fx.advance(90_001);
    expectError(() => fx.store.reserveTurn(owner, 'intent-case', { requestId: 'intent-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'changed-body' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    const reclaimed = fx.store.reserveTurn(owner, 'intent-case', { requestId: 'intent-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'intent-body' });
    assert.equal(reclaimed.kind, 'reserved');
    assert.notEqual(reclaimed.lease.fence, first.lease.fence);
    expectError(() => fx.store.reserveTurn(owner, 'intent-case', { requestId: 'intent-turn', expectedGeneration: 1, expectedRevision: 2, fingerprint: 'intent-body' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
  } finally {
    await fx.cleanup();
  }
});

test('uses one request namespace across completed turn intents and ordinary mutations', async () => {
  const fx = await fixture();
  try {
    const created = fx.store.create(owner, { requestId: 'namespace-create-a', expectedGeneration: 1, id: 'namespace-case-a', title: 'A', mode: 'quick', language: 'en' });
    const lease = fx.store.reserveTurn(owner, 'namespace-case-a', { requestId: 'namespace-request', expectedGeneration: 1, expectedRevision: created.envelope.revision, fingerprint: 'namespace-input' });
    const canonical = committedRecord({ report: 'Namespace report' });
    const committed = fx.store.commitTurn(owner, 'namespace-case-a', { requestId: 'namespace-request', expectedGeneration: 1, expectedRevision: 1, fence: lease.lease.fence, record: canonical });
    assert.equal(committed.receipt.operation, 'turn');
    expectError(() => fx.store.create(owner, { requestId: 'namespace-request', expectedGeneration: 1, id: 'namespace-case-b', title: 'B', mode: 'quick', language: 'en' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    const commitReplay = fx.store.commitTurn(owner, 'namespace-case-a', { requestId: 'namespace-request', expectedGeneration: 1, expectedRevision: 1, fence: lease.lease.fence, record: canonical });
    assert.deepEqual(commitReplay.receipt, committed.receipt);
    assert.equal(commitReplay.envelope.record.report, 'Namespace report');
    const reserveReplay = fx.store.reserveTurn(owner, 'namespace-case-a', { requestId: 'namespace-request', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'namespace-input' });
    assert.equal(reserveReplay.kind, 'replayed');
    assert.deepEqual(reserveReplay.result.receipt, committed.receipt);
  } finally {
    await fx.cleanup();
  }
});

test('rejects ordinary and turn operations that reuse a pending intent request ID elsewhere', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'pending-create-a', expectedGeneration: 1, id: 'pending-case-a', title: 'A', mode: 'quick', language: 'en' });
    fx.store.create(owner, { requestId: 'pending-create-b', expectedGeneration: 1, id: 'pending-case-b', title: 'B', mode: 'quick', language: 'en' });
    const lease = fx.store.reserveTurn(owner, 'pending-case-a', { requestId: 'pending-namespace-request', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'pending-input' });
    expectError(() => fx.store.create(owner, { requestId: 'pending-namespace-request', expectedGeneration: 1, id: 'pending-case-c', title: 'C', mode: 'quick', language: 'en' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    expectError(() => fx.store.update(owner, 'pending-case-a', { requestId: 'pending-namespace-request', expectedGeneration: 1, expectedRevision: 1, title: 'Should reject' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    expectError(() => fx.store.clear(owner, { requestId: 'pending-namespace-request', expectedGeneration: 1, confirmation: 'clear_audit_history' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    expectError(() => fx.store.reserveTurn(owner, 'pending-case-b', { requestId: 'pending-namespace-request', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'pending-input' }), 'AUDIT_HISTORY_IDEMPOTENCY_CONFLICT', 409);
    fx.store.releaseTurn(owner, 'pending-case-a', { requestId: 'pending-namespace-request', expectedGeneration: 1, fence: lease.lease.fence });
    const replayable = fx.store.reserveTurn(owner, 'pending-case-a', { requestId: 'pending-namespace-request', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'pending-input' });
    assert.equal(replayable.kind, 'reserved');
  } finally {
    await fx.cleanup();
  }
});

test('resets owner decision on report correction or completion and never promotes canonical prepare', async () => {
  const fx = await fixture();
  try {
    const completedState = createIntakeState('en');
    completedState.complete = true;
    const incompleteState = createIntakeState('en');
    fx.store.create(owner, { requestId: 'decision-create-a', expectedGeneration: 1, id: 'decision-case-a', title: 'A', mode: 'quick', language: 'en' });
    const firstLease = fx.store.reserveTurn(owner, 'decision-case-a', { requestId: 'decision-turn-a1', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'first-report' });
    fx.store.commitTurn(owner, 'decision-case-a', {
      requestId: 'decision-turn-a1', expectedGeneration: 1, expectedRevision: 1, fence: firstLease.lease.fence,
      record: committedRecord({ intakeState: completedState, report: 'Original completed report', decision: 'unreviewed' }),
    });
    const pilot = { owner: 'Owner', metric: 'qualified cases', baseline: 'ten', target: 'twenty', observed: '', stopRule: 'stop', status: 'draft' };
    fx.store.update(owner, 'decision-case-a', { requestId: 'decision-owner-a', expectedGeneration: 1, expectedRevision: 2, decision: 'prepare', pilot });
    const correctionLease = fx.store.reserveTurn(owner, 'decision-case-a', { requestId: 'decision-turn-a2', expectedGeneration: 1, expectedRevision: 3, fingerprint: 'correction' });
    const correction = fx.store.commitTurn(owner, 'decision-case-a', {
      requestId: 'decision-turn-a2', expectedGeneration: 1, expectedRevision: 3, fence: correctionLease.lease.fence,
      record: committedRecord({ intakeState: incompleteState, report: null, decision: 'prepare' }),
    });
    assert.equal(correction.envelope.record.decision, 'unreviewed');
    assert.deepEqual(correction.envelope.record.pilot, pilot);

    fx.store.create(owner, { requestId: 'decision-create-b', expectedGeneration: 1, id: 'decision-case-b', title: 'B', mode: 'quick', language: 'en' });
    const newLease = fx.store.reserveTurn(owner, 'decision-case-b', { requestId: 'decision-turn-b1', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'new-report' });
    const newReport = fx.store.commitTurn(owner, 'decision-case-b', {
      requestId: 'decision-turn-b1', expectedGeneration: 1, expectedRevision: 1, fence: newLease.lease.fence,
      record: committedRecord({ intakeState: completedState, report: 'New completed report', decision: 'prepare' }),
    });
    assert.equal(newReport.envelope.record.decision, 'unreviewed');
  } finally {
    await fx.cleanup();
  }
});

test('commits reports with bounded history and never lets imported trust continue', async () => {
  const fx = await fixture();
  try {
    const imported = fx.store.importArchive(owner, { requestId: 'import-one', expectedGeneration: 1, record: importedRecord() });
    assert.equal(imported.envelope?.trust, 'imported_unverified');
    assert.notEqual(imported.envelope?.record.id, 'local-case-id');
    expectError(() => fx.store.reserveTurn(owner, imported.envelope.record.id, { requestId: 'import-turn', expectedGeneration: 1, expectedRevision: 1, fingerprint: 'cannot-continue' }), 'AUDIT_HISTORY_UNTRUSTED', 409);
    const created = fx.store.create(owner, { requestId: 'create-report', expectedGeneration: 1, id: 'report-case', title: 'Report', mode: 'quick', language: 'ka' });
    const lease = fx.store.reserveTurn(owner, 'report-case', { requestId: 'report-turn-one', expectedGeneration: 1, expectedRevision: created.envelope.revision, fingerprint: 'report-input-one' });
    const first = fx.store.commitTurn(owner, 'report-case', { requestId: 'report-turn-one', expectedGeneration: 1, expectedRevision: 1, fence: lease.lease.fence, record: committedRecord({ report: 'First report' }) });
    assert.equal(first.envelope.reportRevisions.length, 0);
    const leaseTwo = fx.store.reserveTurn(owner, 'report-case', { requestId: 'report-turn-two', expectedGeneration: 1, expectedRevision: 2, fingerprint: 'report-input-two' });
    const second = fx.store.commitTurn(owner, 'report-case', { requestId: 'report-turn-two', expectedGeneration: 1, expectedRevision: 2, fence: leaseTwo.lease.fence, record: committedRecord({ report: 'Corrected report' }) });
    assert.equal(second.envelope.reportRevisions.length, 1);
    assert.equal(second.envelope.reportRevisions[0].report, 'First report');
    assert.equal(second.envelope.record.report, 'Corrected report');
  } finally {
    await fx.cleanup();
  }
});

test('keeps owner-delete retention inert and purges only explicitly configured timed retention', async () => {
  const ownerDelete = await fixture('owner_delete');
  try {
    ownerDelete.store.create(owner, { requestId: 'owner-delete-create', expectedGeneration: 1, id: 'owner-delete-case', title: 'Keep forever', mode: 'quick', language: 'en' });
    ownerDelete.advance(91 * 24 * 60 * 60 * 1000);
    assert.equal(ownerDelete.store.purgeExpired(), 0);
    assert.equal(ownerDelete.store.get(owner, 'owner-delete-case').record.title, 'Keep forever');
  } finally {
    await ownerDelete.cleanup();
  }

  const timed = await fixture({ days: 90 });
  try {
    timed.store.create(owner, { requestId: 'timed-create', expectedGeneration: 1, id: 'timed-case', title: 'Expire me', mode: 'quick', language: 'en' });
    timed.advance(90 * 24 * 60 * 60 * 1000);
    assert.equal(timed.store.purgeExpired(), 1);
    expectError(() => timed.store.get(owner, 'timed-case'), 'AUDIT_HISTORY_DELETED', 410);
    assert.equal(timed.store.list(owner).items.length, 0);
    expectError(() => timed.store.create(owner, { requestId: 'timed-reuse', expectedGeneration: 1, id: 'timed-case', title: 'Should not resurrect', mode: 'quick', language: 'en' }), 'AUDIT_HISTORY_ID_EXISTS', 409);
  } finally {
    await timed.cleanup();
  }
});

test('denies timed-expired records before maintenance purge without allowing replay or metadata revival', async () => {
  const fx = await fixture({ days: 90 });
  try {
    const created = fx.store.create(owner, { requestId: 'expiry-replay', expectedGeneration: 1, id: 'expiry-read-case', title: 'Expired payload', mode: 'quick', language: 'en' });
    fx.advance(90 * 24 * 60 * 60 * 1000 + 1);
    expectError(() => fx.store.get(owner, 'expiry-read-case'), 'AUDIT_HISTORY_EXPIRED', 410);
    assert.equal(fx.store.list(owner).items.length, 0);
    const replay = fx.store.create(owner, { requestId: 'expiry-replay', expectedGeneration: 1, id: 'expiry-read-case', title: 'Expired payload', mode: 'quick', language: 'en' });
    assert.deepEqual(replay.receipt, created.receipt);
    assert.equal(replay.envelope, null);
    expectError(() => fx.store.update(owner, 'expiry-read-case', { requestId: 'expiry-update', expectedGeneration: 1, expectedRevision: 1, title: 'Must not revive' }), 'AUDIT_HISTORY_EXPIRED', 410);
    expectError(() => fx.store.create(owner, { requestId: 'expiry-revive', expectedGeneration: 1, id: 'expiry-read-case', title: 'Must not revive', mode: 'quick', language: 'en' }), 'AUDIT_HISTORY_ID_EXISTS', 409);
    assert.equal(fx.store.purgeExpired(), 1);
    expectError(() => fx.store.get(owner, 'expiry-read-case'), 'AUDIT_HISTORY_DELETED', 410);
  } finally {
    await fx.cleanup();
  }
});

test('does not reset records after key failure or storage failure', async () => {
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'failure-create', expectedGeneration: 1, id: 'failure-case', title: 'Must survive', mode: 'quick', language: 'en' });
    fx.store.close();
    const missingKey = new HistoryStore({ path: fx.dbPath, keyring: { activeKeyId: 'k-two', keys: new Map([['k-two', keyTwo]]) }, retention: 'owner_delete' });
    try {
      expectError(() => missingKey.get(owner, 'failure-case'), 'AUDIT_HISTORY_KEY_FAILURE', 503);
    } finally {
      missingKey.close();
    }
    const recovered = new HistoryStore({ path: fx.dbPath, keyring: keyring(), retention: 'owner_delete' });
    try {
      assert.equal(recovered.get(owner, 'failure-case').record.title, 'Must survive');
    } finally {
      recovered.close();
    }
  } finally {
    if (!fx.store.closed) fx.store.close();
    await fx.cleanup();
  }
});

test('rejects dangling database symlinks and symlinked ancestors when the OS permits symlink fixtures', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aiaudit-history-path-'));
  const realDirectory = path.join(directory, 'real');
  const linkDirectory = path.join(directory, 'linked');
  const danglingLink = path.join(directory, 'dangling-link.sqlite');
  try {
    await mkdir(realDirectory);
    try {
      await symlink(realDirectory, linkDirectory, 'junction');
      await symlink('missing.sqlite', danglingLink, 'file');
    } catch {
      t.skip('symlink creation is unavailable in this Windows environment');
      return;
    }
    let danglingStore;
    let danglingError;
    try {
      danglingStore = new HistoryStore({ path: danglingLink, keyring: keyring(), retention: 'owner_delete' });
    } catch (error) {
      danglingError = error;
    } finally {
      danglingStore?.close();
    }
    assert.ok(danglingError instanceof HistoryError && danglingError.code === 'AUDIT_HISTORY_INVALID_INPUT');
    assert.throws(
      () => new HistoryStore({ path: path.join(linkDirectory, 'history.sqlite'), keyring: keyring(), retention: 'owner_delete' }),
      (error) => error instanceof HistoryError && error.code === 'AUDIT_HISTORY_INVALID_INPUT',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('restores restrictive POSIX modes without changing persisted records', async (t) => {
  if (process.platform === 'win32') {
    t.skip('POSIX mode-bit enforcement is not observable on Windows');
    return;
  }
  const fx = await fixture();
  try {
    fx.store.create(owner, { requestId: 'disk-create', expectedGeneration: 1, id: 'disk-case', title: 'Disk survives', mode: 'quick', language: 'en' });
    fx.store.close();
    await chmod(fx.directory, 0o755);
    await chmod(fx.dbPath, 0o644);
    const reopened = new HistoryStore({ path: fx.dbPath, keyring: keyring(), retention: 'owner_delete' });
    try {
      assert.equal(reopened.get(owner, 'disk-case').record.title, 'Disk survives');
      assert.equal((await stat(fx.directory)).mode & 0o777, 0o700);
      assert.equal((await stat(fx.dbPath)).mode & 0o777, 0o600);
    } finally {
      reopened.close();
    }
  } finally {
    if (!fx.store.closed) fx.store.close();
    await fx.cleanup();
  }
});

test('fails closed at live-record, tombstone, and clear-receipt quota boundaries', async () => {
  const fx = await fixture();
  try {
    for (let index = 0; index < 50; index += 1) {
      fx.store.create(owner, { requestId: `live-create-${index}`, expectedGeneration: 1, id: `live-case-${index}`, title: 'Quota', mode: 'quick', language: 'en' });
    }
    expectError(() => fx.store.create(owner, { requestId: 'live-create-50', expectedGeneration: 1, id: 'live-case-50', title: 'Quota', mode: 'quick', language: 'en' }), 'AUDIT_HISTORY_CAPACITY', 429);
    for (let index = 0; index < 50; index += 1) {
      fx.store.remove(owner, `live-case-${index}`, { requestId: `live-remove-${index}`, expectedGeneration: 1, expectedRevision: 1 });
    }
    for (let index = 50; index < 256; index += 1) {
      fx.store.create(owner, { requestId: `tombstone-create-${index}`, expectedGeneration: 1, id: `tombstone-case-${index}`, title: 'Quota', mode: 'quick', language: 'en' });
      fx.store.remove(owner, `tombstone-case-${index}`, { requestId: `tombstone-remove-${index}`, expectedGeneration: 1, expectedRevision: 1 });
    }
    fx.store.create(owner, { requestId: 'tombstone-create-256', expectedGeneration: 1, id: 'tombstone-case-256', title: 'Quota', mode: 'quick', language: 'en' });
    expectError(() => fx.store.remove(owner, 'tombstone-case-256', { requestId: 'tombstone-remove-256', expectedGeneration: 1, expectedRevision: 1 }), 'AUDIT_HISTORY_CAPACITY', 503);
    assert.equal(fx.store.get(owner, 'tombstone-case-256').record.title, 'Quota');

    for (let index = 1; index <= 64; index += 1) {
      fx.store.clear(otherOwner, { requestId: `clear-receipt-${index}`, expectedGeneration: index, confirmation: 'clear_audit_history' });
    }
    expectError(() => fx.store.clear(otherOwner, { requestId: 'clear-receipt-65', expectedGeneration: 65, confirmation: 'clear_audit_history' }), 'AUDIT_HISTORY_CAPACITY', 503);
  } finally {
    await fx.cleanup();
  }
});
