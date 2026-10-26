import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';

import { readAuditHistoryConfig } from '../src/lib/audit-history/config.ts';

const key = Buffer.alloc(32, 7).toString('base64');
const otherKey = Buffer.alloc(32, 8).toString('base64');
const base = {
  AUDIT_HISTORY_ENABLED: 'true',
  AUDIT_HISTORY_STORAGE_DIR: path.join(os.tmpdir(), 'aiaudit-config-history'),
  AUDIT_HISTORY_KEYS_JSON: JSON.stringify({ active: key }),
  AUDIT_HISTORY_ACTIVE_KEY_ID: 'active',
  AUDIT_HISTORY_RETENTION: 'owner_delete',
  NODE_ENV: 'test',
};

function config(overrides = {}) {
  return readAuditHistoryConfig({ ...base, ...overrides });
}

function assertUnavailable(fn) {
  assert.throws(fn, (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.code, 'AUDIT_HISTORY_CONFIG_INVALID');
    assert.equal(error.message, 'Audit history configuration unavailable');
    return true;
  });
}

test('disabled is the fail-closed default and does not read enabled settings', () => {
  assert.deepEqual(readAuditHistoryConfig({}), { enabled: false });
  assert.deepEqual(readAuditHistoryConfig({ AUDIT_HISTORY_ENABLED: 'false' }), { enabled: false });
});

test('only an exact true flag enables cloud history', () => {
  for (const value of ['', 'TRUE', 'True', '1', 'yes', 'false ']) {
    assertUnavailable(() => readAuditHistoryConfig({ AUDIT_HISTORY_ENABLED: value }));
  }
  assert.equal(config().enabled, true);
});

test('enabled config applies safe defaults and decodes a dedicated keyring', () => {
  const result = config();
  assert.equal(result.storageDir, base.AUDIT_HISTORY_STORAGE_DIR);
  assert.equal(result.issuer, 'https://api.iai.ge');
  assert.equal(result.jwksUrl, 'https://api.iai.ge/.well-known/jwks.json');
  assert.equal(result.keyring.activeKeyId, 'active');
  assert.deepEqual(Buffer.from(result.keyring.keys.get('active')), Buffer.alloc(32, 7));
  assert.equal(result.retention, 'owner_delete');
});

test('storage directory defaults only after enablement', () => {
  const source = { ...base };
  delete source.AUDIT_HISTORY_STORAGE_DIR;
  assert.equal(readAuditHistoryConfig(source).storageDir, '/app/audit-data/history');
});

test('retention is an explicit owner policy with only the supported values', () => {
  assert.deepEqual(config({ AUDIT_HISTORY_RETENTION: '90d_after_update' }).retention, { days: 90 });
  assert.deepEqual(config({ AUDIT_HISTORY_RETENTION: '365d_after_update' }).retention, { days: 365 });
  for (const value of ['', '90d', '30d_after_update', 'owner-delete']) {
    assertUnavailable(() => config({ AUDIT_HISTORY_RETENTION: value }));
  }
});

test('every required enabled key setting is fail closed', () => {
  for (const name of [
    'AUDIT_HISTORY_KEYS_JSON',
    'AUDIT_HISTORY_ACTIVE_KEY_ID',
    'AUDIT_HISTORY_RETENTION',
  ]) {
    const next = { ...base };
    delete next[name];
    assertUnavailable(() => readAuditHistoryConfig(next));
  }
});

test('storage directory must be absolute and configuration never creates it', () => {
  assertUnavailable(() => config({ AUDIT_HISTORY_STORAGE_DIR: 'relative/history' }));
  assertUnavailable(() => config({ AUDIT_HISTORY_STORAGE_DIR: '' }));
  assertUnavailable(() => config({ AUDIT_HISTORY_STORAGE_DIR: 'C:\\audit\u0000history' }));
});

test('storage directory uses host-native absolute path semantics', () => {
  assert.equal(path.isAbsolute(base.AUDIT_HISTORY_STORAGE_DIR), true);
  assert.equal(config().storageDir, base.AUDIT_HISTORY_STORAGE_DIR);
  if (process.platform !== 'win32') {
    assertUnavailable(() => config({ AUDIT_HISTORY_STORAGE_DIR: 'C:\\audit-data\\history' }));
  }
});

test('keyring rejects malformed, short, oversized, unsafe, and duplicate keys', () => {
  const cases = [
    JSON.stringify({ active: 'not-base64' }),
    JSON.stringify({ active: Buffer.alloc(31, 7).toString('base64') }),
    JSON.stringify({ active: Buffer.alloc(33, 7).toString('base64') }),
    JSON.stringify({ 'bad key': key }),
    JSON.stringify({ active: key, second: key, third: key, fourth: key, fifth: key }),
    '{"active":"' + key + '","active":"' + otherKey + '"}',
  ];
  for (const keys of cases) assertUnavailable(() => config({ AUDIT_HISTORY_KEYS_JSON: keys }));
});

test('active key must be safe and present in the keyring', () => {
  assertUnavailable(() => config({ AUDIT_HISTORY_ACTIVE_KEY_ID: 'missing' }));
  assertUnavailable(() => config({ AUDIT_HISTORY_ACTIVE_KEY_ID: 'bad key' }));
  assertUnavailable(() => config({ AUDIT_HISTORY_ACTIVE_KEY_ID: 'a'.repeat(33) }));
});

test('dedicated history key cannot reuse session or chat API signing material', () => {
  assertUnavailable(() => config({ AUDIT_SESSION_SECRET: Buffer.alloc(32, 7).toString('utf8') }));
  assertUnavailable(() => config({ AUDIT_SESSION_SECRET: key }));
  assertUnavailable(() => config({ CHAT_API_KEY: Buffer.alloc(32, 7).toString('base64') }));
  assert.equal(config({ AUDIT_SESSION_SECRET: 'unrelated-secret' }).enabled, true);
});

test('issuer and JWKS URLs are fixed same-origin server endpoints', () => {
  const valid = config({
    AUDIT_HISTORY_IDP_ISSUER: 'https://idp.test/issuer',
    AUDIT_HISTORY_JWKS_URL: 'https://idp.test/keys',
  });
  assert.equal(valid.issuer, 'https://idp.test/issuer');
  assert.equal(valid.jwksUrl, 'https://idp.test/keys');

  for (const [issuer, jwksUrl] of [
    ['https://idp.test/issuer', 'https://other.test/keys'],
    ['https://idp.test/issuer?x=1', 'https://idp.test/keys'],
    ['https://user:pass@idp.test/issuer', 'https://idp.test/keys'],
    ['https://idp.test/issuer', 'https://idp.test/keys#fragment'],
    ['http://idp.test/issuer', 'http://idp.test/keys'],
  ]) {
    assertUnavailable(() => config({ AUDIT_HISTORY_IDP_ISSUER: issuer, AUDIT_HISTORY_JWKS_URL: jwksUrl }));
  }
});

test('non-production HTTP endpoints are limited to exact loopback origins', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const result = config({
      AUDIT_HISTORY_IDP_ISSUER: `http://${host}/issuer`,
      AUDIT_HISTORY_JWKS_URL: `http://${host}/keys`,
    });
    assert.equal(result.enabled, true);
  }
  assertUnavailable(() => config({
    AUDIT_HISTORY_IDP_ISSUER: 'http://example.test/issuer',
    AUDIT_HISTORY_JWKS_URL: 'http://example.test/keys',
  }));
});

test('production requires HTTPS for both endpoints', () => {
  assertUnavailable(() => config({
    NODE_ENV: 'production',
    AUDIT_HISTORY_IDP_ISSUER: 'http://localhost/issuer',
    AUDIT_HISTORY_JWKS_URL: 'http://localhost/keys',
  }));
});
