import test from 'node:test';
import assert from 'node:assert/strict';

import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import * as authModule from '../src/lib/audit-history/auth.ts';

const { createAuditHistoryAuth } = authModule;

const now = 1_700_000_000;
const issuer = 'https://idp.test';
const jwksUrl = 'https://idp.test/.well-known/jwks.json';

const fixture = await generateKeyPair('EdDSA');
const publicJwk = { ...(await exportJWK(fixture.publicKey)), kid: 'key-1', alg: 'EdDSA', use: 'sig', key_ops: ['verify'] };
const rotatedFixture = await generateKeyPair('EdDSA');
const rotatedPublicJwk = { ...(await exportJWK(rotatedFixture.publicKey)), kid: 'key-2', alg: 'EdDSA', use: 'sig', key_ops: ['verify'] };

function makeFetch(body = { keys: [publicJwk] }, init = {}) {
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    if (init.throw) throw new Error('network fixture failure');
    const responseBody = typeof body === 'function' ? body({ url, options, calls }) : body;
    return new Response(typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody), {
      status: init.status ?? 200,
      headers: init.headers ?? { 'content-type': 'application/json' },
    });
  };
  return { fetch, calls };
}

function authWith(fetchFixture, options = {}) {
  return createAuditHistoryAuth({ issuer, jwksUrl }, {
    fetch: fetchFixture.fetch,
    now: () => now,
    ...options,
  });
}

async function token(claims = {}, protectedHeader = {}) {
  return tokenWithKey(fixture.privateKey, claims, protectedHeader);
}

async function tokenWithKey(privateKey, claims = {}, protectedHeader = {}) {
  return new SignJWT({
    iss: issuer,
    aud: 'aiaudit',
    sub: 'user-1',
    account_id: 'account-1',
    iat: now,
    exp: now + 120,
    jti: 'jti-1',
    scope: ['audit:read', 'audit:write'],
    ...claims,
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'key-1', typ: 'JWT', ...protectedHeader })
    .sign(privateKey);
}

function replaceProtectedHeader(signedToken, header) {
  const encoded = Buffer.from(JSON.stringify(header)).toString('base64url');
  const [, payload, signature] = signedToken.split('.');
  return `${encoded}.${payload}.${signature}`;
}

async function assertStatus(promise, status) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status);
    assert.match(error.message, /^Audit history /);
    assert.doesNotMatch(error.message, /user-1|account-1|jti-1|Bearer|token|idp\.test/iu);
    return true;
  });
}

test('valid minimal EdDSA identity verifies against the fixed audience and is frozen', async () => {
  const fetched = makeFetch();
  const principal = await authWith(fetched).verify(`Bearer ${await token()}`, 'audit:read');
  assert.deepEqual(principal, { userId: 'user-1', accountId: 'account-1' });
  assert.equal(Object.isFrozen(principal), true);
  assert.equal(fetched.calls.length, 1);
});

test('one long-lived factory reuses JWKS cache and unknown-key cooldown across requests', async () => {
  assert.equal('verifyAuditPrincipal' in authModule, false);
  const fetched = makeFetch();
  const auth = authWith(fetched);
  await auth.verify(`Bearer ${await token()}`, 'audit:read');
  await auth.verify(`Bearer ${await token()}`, 'audit:read');
  await assertStatus(auth.verify(`Bearer ${await token({}, { kid: 'unknown' })}`, 'audit:read'), 401);
  await assertStatus(auth.verify(`Bearer ${await token({}, { kid: 'unknown' })}`, 'audit:read'), 401);
  assert.equal(fetched.calls.length, 1);
});

test('omitting the fetch option uses the runtime fetch implementation', async () => {
  const originalFetch = globalThis.fetch;
  const fetched = makeFetch();
  globalThis.fetch = fetched.fetch;
  try {
    const principal = await createAuditHistoryAuth({ issuer, jwksUrl }, { now: () => now })
      .verify(`Bearer ${await token()}`, 'audit:read');
    assert.deepEqual(principal, { userId: 'user-1', accountId: 'account-1' });
    assert.equal(fetched.calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('verified identity missing the operation scope is forbidden', async () => {
  const fetched = makeFetch();
  await assertStatus(
    authWith(fetched).verify(`Bearer ${await token({ scope: ['audit:read'] })}`, 'audit:write'),
    403,
  );
});

test('missing or malformed bearer tokens fail before any JWKS request', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  for (const value of [null, '', 'Basic abc', 'Bearer', 'Bearer one two', 'Bearer a.b', 'Bearer a.b.c.d']) {
    await assertStatus(auth.verify(value, 'audit:read'), 401);
  }
  assert.equal(fetched.calls.length, 0);
});

test('unsupported local headers fail before any JWKS request', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  const signed = await token();
  for (const header of [
    { alg: 'none', kid: 'key-1', typ: 'JWT' },
    { alg: 'HS256', kid: 'key-1', typ: 'JWT' },
    { alg: 'EdDSA', kid: 'key-1', typ: 'JWS' },
    { alg: 'EdDSA', kid: 'key-1', typ: 'JWT', jku: jwksUrl },
    { alg: 'EdDSA', kid: 'key-1', typ: 'JWT', crit: ['exp'] },
  ]) {
    await assertStatus(auth.verify(`Bearer ${replaceProtectedHeader(signed, header)}`, 'audit:read'), 401);
  }
  assert.equal(fetched.calls.length, 0);
});

test('token length is bounded before remote verification', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  const oversized = `${await token()}${'x'.repeat(12 * 1024)}`;
  await assertStatus(auth.verify(`Bearer ${oversized}`, 'audit:read'), 401);
  assert.equal(fetched.calls.length, 0);
});

test('claim type, identity, audience, issuer, and lifetime denials are invalid tokens', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  const cases = [
    { sub: 1 },
    { sub: '' },
    { account_id: 1 },
    { jti: '' },
    { iat: now + 6 },
    { exp: now - 6 },
    { exp: now + 301 },
    { iat: now - 301, exp: now },
    { aud: ['aiaudit'] },
    { aud: 'other' },
    { iss: 'https://other.test' },
    { scope: 'audit:read' },
    { scope: [] },
    { scope: Array.from({ length: 9 }, (_, index) => `scope-${index}`) },
    { scope: ['x'.repeat(65)] },
  ];
  for (const claims of cases) await assertStatus(auth.verify(`Bearer ${await token(claims)}`, 'audit:read'), 401);
});

test('required identity claims cannot be omitted', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  for (const name of ['sub', 'account_id', 'iat', 'exp', 'jti', 'scope']) {
    const claims = { sub: 'user-1', account_id: 'account-1', iat: now, exp: now + 120, jti: 'jti-1', scope: ['audit:read'] };
    claims[name] = undefined;
    await assertStatus(auth.verify(`Bearer ${await token(claims)}`, 'audit:read'), 401);
  }
});

test('JWKS requests are fixed GET/manual redirect, bounded, and credential-free', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  await auth.verify(`Bearer ${await token()}`, 'audit:read');
  assert.equal(fetched.calls[0].url, jwksUrl);
  assert.equal(fetched.calls[0].options.method, 'GET');
  assert.equal(fetched.calls[0].options.redirect, 'manual');
  assert.equal(fetched.calls[0].options.headers.get('authorization'), null);
  assert.equal(fetched.calls[0].options.headers.get('cookie'), null);
});

test('network, HTTP, redirect, oversized, malformed, and invalid-key JWKS failures are unavailable', async () => {
  for (const fixtureCase of [
    makeFetch(null, { throw: true }),
    makeFetch({ keys: [publicJwk] }, { status: 500 }),
    makeFetch({ keys: [publicJwk] }, { status: 302, headers: { location: 'https://evil.test/keys' } }),
    makeFetch('x'.repeat(64 * 1024 + 1)),
    makeFetch('{not-json'),
    makeFetch({ keys: [{ ...publicJwk, d: 'private' }] }),
    makeFetch({ keys: [{ ...publicJwk }, { ...publicJwk }] }),
    makeFetch({ keys: [{ ...publicJwk, x: 'bad' }] }),
  ]) {
    await assertStatus(authWith(fixtureCase).verify(`Bearer ${await token()}`, 'audit:read'), 503);
  }
});

test('unknown key id is denied and jose remote-set cooldown prevents a refresh storm', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  await assertStatus(auth.verify(`Bearer ${await token({}, { kid: 'unknown' })}`, 'audit:read'), 401);
  await assertStatus(auth.verify(`Bearer ${await token({}, { kid: 'unknown' })}`, 'audit:read'), 401);
  assert.equal(fetched.calls.length, 1);
});

test('jose cache refreshes a rotated key only after the unknown-key cooldown', async () => {
  const originalDateNow = Date.now;
  let clock = 10_000_000;
  Date.now = () => clock;
  try {
    const fetched = makeFetch(() => ({ keys: fetched.calls.length === 1 ? [publicJwk] : [rotatedPublicJwk] }));
    const auth = authWith(fetched);
    await auth.verify(`Bearer ${await token()}`, 'audit:read');
    const rotated = await tokenWithKey(rotatedFixture.privateKey, {}, { kid: 'key-2' });
    await assertStatus(auth.verify(`Bearer ${rotated}`, 'audit:read'), 401);
    assert.equal(fetched.calls.length, 1);
    clock += 30_001;
    const principal = await auth.verify(`Bearer ${rotated}`, 'audit:read');
    assert.deepEqual(principal, { userId: 'user-1', accountId: 'account-1' });
    assert.equal(fetched.calls.length, 2);
  } finally {
    Date.now = originalDateNow;
  }
});

test('the verifier never accepts a caller-selected JWKS URL', async () => {
  const fetched = makeFetch();
  const auth = authWith(fetched);
  await assertStatus(auth.verify(`Bearer ${await token({}, { jku: 'https://evil.test/keys' })}`, 'audit:read'), 401);
  assert.equal(fetched.calls.length, 0);
});
