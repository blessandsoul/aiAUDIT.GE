import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const docker = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
test('provider image build enforces all audit regressions and real POSIX denial before compilation', () => {
  const gate = docker.indexOf('RUN npm run test:audit && npm run test:audit:posix');
  const build = docker.indexOf('RUN npm run build -- --webpack');
  assert.ok(gate > docker.indexOf('COPY . .'));
  assert.ok(build > gate);
});
test('provider runtime remains pinned and unprivileged with cloud disabled by default', () => {
  assert.ok(docker.includes('node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd'));
  assert.ok(docker.includes('USER nextjs'));
  assert.ok(docker.includes('ENV AUDIT_HISTORY_ENABLED=false'));
});
