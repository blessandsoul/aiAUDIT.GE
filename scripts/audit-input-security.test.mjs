import test from 'node:test';
import assert from 'node:assert/strict';

import { containsAuditCredentials, containsSensitiveAuditInput } from '../src/lib/audit-input-security.ts';

test('credential-only guard detects URL labels without treating numeric paths as credentials', () => {
  assert.equal(containsAuditCredentials('https://example.test/?api_key=hidden-secret-value'), true);
  assert.equal(containsAuditCredentials('https://example.test/?api%5Fkey=hidden-secret-value'), false);
  assert.equal(containsAuditCredentials('https://example.test/4111111111111111'), false);
});

test('detects the supported opaque credential formats', () => {
  for (const value of [
    'sk-proj-fakeabcdefghijklmnop',
    'apify_api_fakeabcdefghijklmnop',
    'ghp_fakeabcdefghijklmnop',
    'github_pat_fakeabcdefghijklmnop',
    'AIzaFakeabcdefghijklmnopqrst',
    'AKIA' + 'ABCDEFGHIJKLMNOP', // Explicit synthetic credential, not an issued key.
    'ASIAABCDEFGHIJKLMNOP',
    '-----BEGIN PRIVATE KEY-----',
    'Authorization: Bearer fake-token-value-1234',
  ]) assert.equal(containsSensitiveAuditInput(value), true, value);
});

test('detects explicit credential labels in English, Russian, and Georgian', () => {
  for (const value of [
    'api_key: fake-key-value-1234',
    'access token = fake-access-value-1234',
    'password: fake-password-1234',
    'password: "fake password"',
    'пароль: fake-password-1234',
    'ключ= fake-key-value-1234',
    'ტოკენი: fake-token-value-1234',
    'პაროლი: fake-password-1234',
    'გასაღები = fake-key-value-1234',
  ]) assert.equal(containsSensitiveAuditInput(value), true, value);
});

test('detects quoted JSON labels and values in English, Russian, and Georgian', () => {
  for (const value of [
    '{"password":"fake-password-1234"}',
    '{"api_key":"fake-key-value-1234"}',
    '{"access_token":"fake-access-value-1234"}',
    '{"пароль":"fake-password-1234"}',
    '{"ключ":"fake-key-value-1234"}',
    '{"პაროლი":"fake-password-1234"}',
    '{"გასაღები":"fake-key-value-1234"}',
  ]) assert.equal(containsSensitiveAuditInput(value), true, value);
});

test('removes zero-width and bidi format controls before detection', () => {
  assert.equal(containsSensitiveAuditInput('s\u200bk-proj-fakeabcdefghijklmnop'), true);
  assert.equal(containsSensitiveAuditInput('api_\u202ekey: fake-key-value-1234'), true);
});

test('normalizes compatible characters before detection', () => {
  assert.equal(containsSensitiveAuditInput('ｐａｓｓｗｏｒｄ: fake-password-1234'), true);
});

test('detects only Luhn-valid thirteen-to-nineteen digit card candidates', () => {
  assert.equal(containsSensitiveAuditInput('4111 1111 1111 1111'), true);
  assert.equal(containsSensitiveAuditInput('4111-1111-1111-1111'), true);
  assert.equal(containsSensitiveAuditInput('4111111111111112'), false);
});

test('does not classify ordinary process language, phones, counts, prices, or channel names', () => {
  for (const value of [
    'We help customers reset passwords when they forget them.',
    'Call us at 599 95 66 75.',
    'We handle 1234567890123 orders over several months.',
    'The business pays 1200 per month.',
    'Instagram and Facebook are our channels.',
    'The order process has three approval steps.',
    'password and API key are examples we discuss in training.',
  ]) assert.equal(containsSensitiveAuditInput(value), false, value);
});
