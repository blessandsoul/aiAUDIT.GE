import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateCursor,
  validateOperationBody,
  validatePathSegments,
} from '../src/lib/audit-history/validation.ts';

const baseCreate = {
  id: 'case-one',
  requestId: 'request-one',
  expectedGeneration: 0,
  title: 'A case',
  mode: 'quick',
  language: 'en',
};

test('operation validation accepts the exact create, update, turn, clear, remove and import shapes', () => {
  assert.deepEqual(validateOperationBody('create', baseCreate), baseCreate);
  assert.deepEqual(validateOperationBody('update', {
    requestId: 'request-two', expectedGeneration: 0, expectedRevision: 1, decision: 'prepare',
  }), {
    requestId: 'request-two', expectedGeneration: 0, expectedRevision: 1, decision: 'prepare',
  });
  assert.deepEqual(validateOperationBody('turn', {
    requestId: 'request-three', expectedGeneration: 0, expectedRevision: 1, content: 'A clear answer', finish: true,
  }), {
    requestId: 'request-three', expectedGeneration: 0, expectedRevision: 1, content: 'A clear answer', finish: true,
  });
  assert.deepEqual(validateOperationBody('remove', { requestId: 'request-four', expectedGeneration: 0, expectedRevision: 1 }), {
    requestId: 'request-four', expectedGeneration: 0, expectedRevision: 1,
  });
  assert.deepEqual(validateOperationBody('clear', { requestId: 'request-five', expectedGeneration: 0, confirmation: 'clear_audit_history' }), {
    requestId: 'request-five', expectedGeneration: 0, confirmation: 'clear_audit_history',
  });
  const record = {
    id: 'local-case', title: 'Imported', mode: 'quick', language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [], intakeState: null, assessment: null, report: null,
    decision: 'unreviewed', pilot: null,
  };
  assert.deepEqual(validateOperationBody('import', { requestId: 'request-six', expectedGeneration: 0, record }), {
    requestId: 'request-six', expectedGeneration: 0, record,
  });
});

test('operation validation rejects unknown mutation fields and client-owned report/state/owner input', () => {
  assert.throws(() => validateOperationBody('create', { ...baseCreate, report: 'invented' }), /Invalid audit history request/);
  assert.throws(() => validateOperationBody('turn', {
    requestId: 'r', expectedGeneration: 0, expectedRevision: 1, content: 'answer', state: {}, report: 'fake', facts: {},
  }), /Invalid audit history request/);
  assert.throws(() => validateOperationBody('update', {
    requestId: 'r', expectedGeneration: 0, expectedRevision: 1, owner: 'caller',
  }), /Invalid audit history request/);
});

test('import validation recognizes the canonical state fields but rejects unknown extra state structures', () => {
  const record = {
    id: 'local-case', title: 'Imported', mode: 'quick', language: 'en',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    messages: [{ id: 'm1', role: 'user', content: 'answer' }],
    intakeState: {
      version: 2, mode: 'quick', turn: 1, language: 'en', focus: 'discovery', focusQuote: '',
      facts: {}, asked: {}, currentQuestion: null, complete: false, stopReason: null,
      history: [{ role: 'user', content: 'answer' }], proof: null,
    },
    assessment: null, report: null, decision: 'unreviewed', pilot: null,
  };
  assert.equal(validateOperationBody('import', { requestId: 'r', expectedGeneration: 0, record }).record, record);
  assert.throws(() => validateOperationBody('import', {
    requestId: 'r', expectedGeneration: 0, record: {
      ...record,
      intakeState: { ...record.intakeState, arbitraryExtraState: { hidden: true } },
    },
  }), /Invalid audit history request/);
  assert.throws(() => validateOperationBody('import', {
    requestId: 'r', expectedGeneration: 0, record: {
      ...record,
      messages: [{ id: 'm1', role: 'user', content: 'x'.repeat(20_001) }],
    },
  }), /Invalid audit history request/);
});

test('path and cursor validation reject traversal, encoded separators, percent escapes and duplicate cursor semantics', () => {
  assert.deepEqual(validatePathSegments([]), []);
  assert.deepEqual(validatePathSegments(['case-one']), ['case-one']);
  assert.deepEqual(validatePathSegments(['case-one', 'turn']), ['case-one', 'turn']);
  for (const segments of [['.'], ['..'], ['case/one'], ['case%2Fone'], ['import', 'extra'], ['case-one', 'bad']]) {
    assert.throws(() => validatePathSegments(segments), /Invalid audit history request/);
  }
  assert.equal(validateCursor(undefined), undefined);
  assert.equal(validateCursor('abc_123'), 'abc_123');
  for (const value of ['', 'a/b', '%2F', '.', 'x'.repeat(2_049)]) {
    assert.throws(() => validateCursor(value), /Invalid audit history request/);
  }
});
