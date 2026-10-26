import assert from 'node:assert/strict';
import { lstat, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

import { HistoryStore } from '../src/lib/audit-history/store.ts';
import { createAuditHistoryAuth } from '../src/lib/audit-history/auth.ts';
import { createAuditHistoryAdmission, createAuditHistoryHandler, readAuditHistoryJsonBody } from '../src/lib/audit-history/http.ts';
import { auditHistoryRuntimeHandler, closeAuditHistoryRuntime } from '../src/lib/audit-history/runtime.ts';

const now = 1_800_000_000;
const issuer = 'https://idp.test';
const jwksUrl = `${issuer}/.well-known/jwks.json`;
const ownerKey = await generateKeyPair('EdDSA');
const publicJwk = { ...(await exportJWK(ownerKey.publicKey)), kid: 'key-one', alg: 'EdDSA', use: 'sig', key_ops: ['verify'] };
const key = new Uint8Array(32).fill(0x55);
process.env.AUDIT_SESSION_SECRET = 'http-test-session-secret-2026';

async function token(userId = 'user-one', accountId = 'account-one', scope = ['audit:read', 'audit:write']) {
  return new SignJWT({ iss: issuer, aud: 'aiaudit', sub: userId, account_id: accountId, iat: now, exp: now + 120, jti: `${userId}-jti`, scope })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'key-one', typ: 'JWT' }).sign(ownerKey.privateKey);
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aiaudit-history-http-'));
  const store = new HistoryStore({ path: path.join(directory, 'history.sqlite'), keyring: { activeKeyId: 'active', keys: new Map([['active', key]]) }, retention: 'owner_delete', now: () => now * 1000 });
  const auth = createAuditHistoryAuth({ issuer, jwksUrl }, { fetch: async () => new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200, headers: { 'content-type': 'application/json' } }), now: () => now });
  const handler = createAuditHistoryHandler({ store, auth, extractor: async () => ({ focus: 'discovery', focusEvidence: '', updates: [], nextField: null }) });
  return { directory, store, handler };
}

function request(method, body, bearer, pathName = '/api/audit-history', headers = {}) {
  return new Request(`https://aiaudit.test${pathName}`, {
    method,
    headers: { authorization: bearer ? `Bearer ${bearer}` : '', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('HTTP handler authenticates with a real EdDSA verifier before reading caller data and emits safe headers', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const body = { id: 'case-one', requestId: 'create-one', expectedGeneration: 1, title: 'Case', mode: 'quick', language: 'en' };
  const response = await fx.handler(request('POST', body, await token()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const payload = await response.json();
  assert.equal(payload.receipt.operation, 'create');
  assert.equal(payload.envelope.trust, 'provider');

  let read = false;
  const unread = { method: 'POST', url: 'https://aiaudit.test/api/audit-history', headers: new Headers({ 'content-type': 'application/json' }), signal: new AbortController().signal, get body() { read = true; throw new Error('body should not be read'); } };
  const unauthorized = await fx.handler(unread);
  assert.equal(unauthorized.status, 401);
  assert.equal(read, false);
});

test('HTTP handler enforces scopes, strict body limits, owner isolation, and canonical turns', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const readOnly = await token('read-user', 'read-account', ['audit:read']);
  const denied = await fx.handler(request('POST', { id: 'case', requestId: 'r', expectedGeneration: 1, title: '', mode: 'quick', language: 'en' }, readOnly));
  assert.equal(denied.status, 403);
  const created = await fx.handler(request('POST', { id: 'case-one', requestId: 'create-one', expectedGeneration: 1, title: '', mode: 'quick', language: 'en' }, await token()));
  const envelope = (await created.clone().json()).envelope;
  const turn = await fx.handler(request('POST', { requestId: 'turn-one', expectedGeneration: 1, expectedRevision: envelope.revision, content: 'answer', finish: true }, await token(), '/api/audit-history/case-one/turn'), ['case-one', 'turn']);
  assert.equal(turn.status, 200);
  const list = await fx.handler(request('GET', undefined, await token()));
  assert.equal((await list.json()).items.length, 1);
  const foreign = await fx.handler(request('GET', undefined, await token('other-user', 'other-account'), '/api/audit-history/case-one'), ['case-one']);
  assert.equal(foreign.status, 404);
  const unknown = await fx.handler(request('POST', { id: 'case-two', requestId: 'bad', expectedGeneration: 1, title: '', mode: 'quick', language: 'en', report: 'caller-owned' }, await token()));
  assert.equal(unknown.status, 400);
  const tooLarge = await fx.handler(new Request('https://aiaudit.test/api/audit-history', { method: 'POST', headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'large', requestId: 'large-request', expectedGeneration: 1, title: 'x'.repeat(1_100_000), mode: 'quick', language: 'en' }) }));
  assert.equal(tooLarge.status, 413);
});

test('runtime configuration is fail-closed before request body parsing when cloud history is disabled', async () => {
  const old = process.env.AUDIT_HISTORY_ENABLED;
  delete process.env.AUDIT_HISTORY_ENABLED;
  let read = false;
  try {
    const request = { method: 'POST', url: 'https://aiaudit.test/api/audit-history', headers: new Headers({ 'content-type': 'application/json' }), signal: new AbortController().signal, get body() { read = true; throw new Error('body should not be read'); } };
    const response = await auditHistoryRuntimeHandler(request);
    assert.equal(response.status, 503);
    assert.equal(read, false);
  } finally {
    if (old === undefined) delete process.env.AUDIT_HISTORY_ENABLED;
    else process.env.AUDIT_HISTORY_ENABLED = old;
  }
});

test('HTTP metadata, deletion, clear, import, and strict query/path boundaries use provider receipts', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const bearer = await token();
  const create = await fx.handler(request('POST', { id: 'case-one', requestId: 'create-one', expectedGeneration: 1, title: 'Before', mode: 'quick', language: 'en' }, bearer));
  const created = await create.json();
  const read = await fx.handler(request('GET', undefined, bearer, '/api/audit-history/case-one'), ['case-one']);
  assert.equal((await read.json()).record.title, 'Before');
  const updated = await fx.handler(request('PATCH', { requestId: 'update-one', expectedGeneration: 1, expectedRevision: 1, title: 'After' }, bearer, '/api/audit-history/case-one'), ['case-one']);
  const updateResult = await updated.json();
  assert.equal(updateResult.receipt.operation, 'update');
  const removed = await fx.handler(request('DELETE', { requestId: 'remove-one', expectedGeneration: 1, expectedRevision: 2 }, bearer, '/api/audit-history/case-one'), ['case-one']);
  assert.equal((await removed.json()).envelope, null);
  assert.equal((await fx.handler(request('GET', undefined, bearer, '/api/audit-history/case-one'), ['case-one'])).status, 410);

  const clearedCreate = await fx.handler(request('POST', { id: 'clear-case', requestId: 'create-clear', expectedGeneration: 1, title: '', mode: 'quick', language: 'en' }, bearer));
  assert.equal(clearedCreate.status, 200);
  const cleared = await fx.handler(request('DELETE', { requestId: 'clear-one', expectedGeneration: 1, confirmation: 'clear_audit_history' }, bearer));
  const clearResult = await cleared.json();
  assert.equal(clearResult.receipt.operation, 'clear');
  assert.equal(clearResult.receipt.generation, 2);

  const imported = await fx.handler(request('POST', {
    requestId: 'import-one', expectedGeneration: 2,
    record: { id: 'local', title: 'Local archive', mode: 'quick', language: 'en', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', messages: [], intakeState: null, assessment: null, report: 'Historical', decision: 'unreviewed', pilot: null },
  }, bearer, '/api/audit-history/import'), ['import']);
  const importResult = await imported.json();
  assert.equal(importResult.receipt.operation, 'import');
  assert.equal(importResult.envelope.trust, 'imported_unverified');
  assert.equal(importResult.envelope.record.id, importResult.receipt.id);

  assert.equal((await fx.handler(request('GET', undefined, bearer, '/api/audit-history?cursor=a/b'))).status, 400);
  assert.equal((await fx.handler(request('GET', undefined, bearer, '/api/audit-history?cursor=a&cursor=b'))).status, 400);
  assert.equal((await fx.handler(request('GET', undefined, bearer, '/api/audit-history/../case-one'), ['..', 'case-one'])).status, 404);
  assert.equal((await fx.handler(request('POST', { id: 'bad-content-type', requestId: 'bad-content-type', expectedGeneration: 2, title: '', mode: 'quick', language: 'en' }, bearer, '/api/audit-history', { 'content-type': 'text/plain' }))).status, 400);
  assert.equal((await fx.handler(request('OPTIONS', undefined, bearer))).status, 405);
  void created;
});

test('an already-aborted request is cancelled before authentication/admission', async (t) => {
  const fx = await fixture();
  t.after(async () => { fx.store.close(); await rm(fx.directory, { recursive: true, force: true }); });
  const controller = new AbortController();
  controller.abort();
  let bodyRead = false;
  const response = await fx.handler({
    method: 'POST',
    url: 'https://aiaudit.test/api/audit-history',
    headers: new Headers({ authorization: 'Bearer not-read', 'content-type': 'application/json' }),
    signal: controller.signal,
    get body() { bodyRead = true; throw new Error('body should not be read'); },
  });
  assert.equal(response.status, 504);
  assert.equal(bodyRead, false);
});

test('streamed request body deadline returns a fixed 504 without leaving the reader running', async () => {
  const request = {
    headers: new Headers({ 'content-type': 'application/json' }),
    signal: new AbortController().signal,
    body: new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('{"valid":true}')); },
      pull() { return new Promise(() => {}); },
    }),
  };
  await assert.rejects(readAuditHistoryJsonBody(request), (error) => {
    assert.equal(error.status, 504);
    assert.equal(error.code, 'AUDIT_HISTORY_TIMEOUT');
    return true;
  });
});

test('runtime creates only the fixed private history directory and rejects live config changes as restart-required', async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'aiaudit-history-runtime-'));
  const names = ['AUDIT_HISTORY_ENABLED', 'AUDIT_HISTORY_STORAGE_DIR', 'AUDIT_HISTORY_KEYS_JSON', 'AUDIT_HISTORY_ACTIVE_KEY_ID', 'AUDIT_HISTORY_RETENTION', 'AUDIT_HISTORY_IDP_ISSUER', 'AUDIT_HISTORY_JWKS_URL', 'NODE_ENV'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const keyOne = Buffer.alloc(32, 0x61).toString('base64');
  const keyTwo = Buffer.alloc(32, 0x62).toString('base64');
  try {
    process.env.NODE_ENV = 'test';
    process.env.AUDIT_HISTORY_ENABLED = 'true';
    process.env.AUDIT_HISTORY_STORAGE_DIR = parent;
    process.env.AUDIT_HISTORY_KEYS_JSON = JSON.stringify({ one: keyOne, two: keyTwo });
    process.env.AUDIT_HISTORY_ACTIVE_KEY_ID = 'one';
    process.env.AUDIT_HISTORY_RETENTION = 'owner_delete';
    process.env.AUDIT_HISTORY_IDP_ISSUER = 'http://127.0.0.1/issuer';
    process.env.AUDIT_HISTORY_JWKS_URL = 'http://127.0.0.1/keys';
    const first = await auditHistoryRuntimeHandler(new Request('https://aiaudit.test/api/audit-history'));
    assert.equal(first.status, 401);
    const privateDir = path.join(parent, 'aiaudit-history-v1');
    assert.equal((await lstat(privateDir)).isDirectory(), true);
    assert.equal((await lstat(path.join(privateDir, 'history.sqlite'))).isFile(), true);
    process.env.AUDIT_HISTORY_ACTIVE_KEY_ID = 'two';
    const changed = await auditHistoryRuntimeHandler(new Request('https://aiaudit.test/api/audit-history'));
    assert.equal(changed.status, 503);
    assert.equal((await changed.json()).code, 'AUDIT_HISTORY_RESTART_REQUIRED');
    process.env.AUDIT_HISTORY_ACTIVE_KEY_ID = 'one';
    const restored = await auditHistoryRuntimeHandler(new Request('https://aiaudit.test/api/audit-history'));
    assert.equal(restored.status, 503);
    assert.equal((await restored.json()).code, 'AUDIT_HISTORY_RESTART_REQUIRED');
  } finally {
    await closeAuditHistoryRuntime();
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    await rm(parent, { recursive: true, force: true });
  }
});

test('owner admission keeps read counters/concurrency independent from writes while retaining the thirty-write cap', () => {
  let now = 0;
  const admission = createAuditHistoryAdmission({ now: () => now, maxReadConcurrency: 1, maxWriteConcurrency: 1 });
  const principal = { userId: 'admission-user', accountId: 'admission-account' };
  const read = admission.acquire(principal, 'read');
  assert.ok(read);
  assert.equal(admission.acquire(principal, 'read'), null);
  const writeWhileRead = admission.acquire(principal, 'write');
  assert.ok(writeWhileRead);
  writeWhileRead.release();
  read.release();
  for (let index = 0; index < 29; index += 1) {
    const lease = admission.acquire(principal, 'write');
    assert.ok(lease);
    lease.release();
  }
  assert.equal(admission.acquire(principal, 'write'), null);
  const readAfterWrites = admission.acquire(principal, 'read');
  assert.ok(readAfterWrites);
  readAfterWrites.release();
  now = 60_000;
});
