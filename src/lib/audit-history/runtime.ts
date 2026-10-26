import { chmodSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { createAuditHistoryAuth } from './auth.ts';
import { readAuditHistoryConfig, type AuditHistoryConfig, type AuditHistoryConfigResult } from './config.ts';
import { createAuditHistoryHandler, type AuditHistoryHandlerDeps } from './http.ts';
import type { HistoryStore } from './store.ts';
import { HistoryError } from './types.ts';
import { HistoryStore as SqlHistoryStore } from './store.ts';

type RuntimeHandler = (request: Request, segments?: readonly string[]) => Promise<Response>;

type RuntimeEntry = Readonly<{
  fingerprint: string;
  store: HistoryStore;
  handler: RuntimeHandler;
}>;

let active: RuntimeEntry | null = null;
let restartRequired = false;

function runtimeResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: message, code }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

function configFingerprint(config: AuditHistoryConfigResult): string {
  if (config.enabled === false) return 'disabled';
  const keyValues = [...config.keyring.keys.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, key]) => `${id}:${Buffer.from(key).toString('base64url')}`)
    .join('|');
  return JSON.stringify({
    storageDir: config.storageDir,
    activeKeyId: config.keyring.activeKeyId,
    keyValues,
    retention: config.retention,
    issuer: config.issuer,
    jwksUrl: config.jwksUrl,
  });
}

function privateStoragePath(storageDir: string): string {
  let parent;
  try { parent = lstatSync(storageDir); } catch { throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE'); }
  if (!parent.isDirectory() || parent.isSymbolicLink()) throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  const privateDir = join(storageDir, 'aiaudit-history-v1');
  try {
    mkdirSync(privateDir, { recursive: true, mode: 0o700 });
    const info = lstatSync(privateDir);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('unsafe history directory');
    if (process.platform !== 'win32') chmodSync(privateDir, 0o700);
  } catch {
    throw new HistoryError(503, 'AUDIT_HISTORY_STORAGE_FAILURE');
  }
  return join(privateDir, 'history.sqlite');
}

function buildRuntime(config: AuditHistoryConfig, fingerprint: string): RuntimeEntry {
  const dbPath = privateStoragePath(config.storageDir);
  const store = new SqlHistoryStore({ path: dbPath, keyring: config.keyring, retention: config.retention });
  const auth = createAuditHistoryAuth({ issuer: config.issuer, jwksUrl: config.jwksUrl });
  const deps: AuditHistoryHandlerDeps = { store, auth };
  const handler = createAuditHistoryHandler(deps);
  return Object.freeze({ fingerprint, store, handler });
}

function readConfig(): AuditHistoryConfigResult | null {
  try {
    return readAuditHistoryConfig();
  } catch {
    return null;
  }
}

function getEntry(config: AuditHistoryConfig): RuntimeEntry {
  const fingerprint = configFingerprint(config);
  if (restartRequired) throw new HistoryError(503, 'AUDIT_HISTORY_RESTART_REQUIRED');
  if (active !== null) {
    if (active.fingerprint !== fingerprint) {
      restartRequired = true;
      throw new HistoryError(503, 'AUDIT_HISTORY_RESTART_REQUIRED');
    }
    return active;
  }
  const entry = buildRuntime(config, fingerprint);
  active = entry;
  return entry;
}

export async function auditHistoryRuntimeHandler(request: Request, segments: readonly string[] = []): Promise<Response> {
  const config: AuditHistoryConfigResult | null = readConfig();
  if (config === null) {
    if (active !== null) restartRequired = true;
    return runtimeResponse(503, 'AUDIT_HISTORY_CONFIG_INVALID', 'Audit history configuration unavailable');
  }
  if (config.enabled === false) {
    if (active !== null) restartRequired = true;
    // Disabled/missing configuration must short-circuit before body parsing,
    // JWT work, SQLite initialization, or any extractor/model call.
    return runtimeResponse(503, 'AUDIT_HISTORY_UNAVAILABLE', 'Audit history is unavailable');
  }
  try {
    return await getEntry(config).handler(request, segments);
  } catch (error) {
    if (error instanceof HistoryError) {
      const code = error.code;
      const message = code === 'AUDIT_HISTORY_RESTART_REQUIRED'
        ? 'Audit history requires a restart'
        : code === 'AUDIT_HISTORY_CONFIG_INVALID'
          ? 'Audit history configuration unavailable'
          : code === 'AUDIT_HISTORY_STORAGE_FAILURE'
            ? 'Audit history storage is unavailable'
            : 'Audit history is unavailable';
      return runtimeResponse(error.status, code, message);
    }
    return runtimeResponse(503, 'AUDIT_HISTORY_UNAVAILABLE', 'Audit history is unavailable');
  }
}

export function getAuditHistoryHandler(): RuntimeHandler {
  return auditHistoryRuntimeHandler;
}

export async function closeAuditHistoryRuntime(): Promise<void> {
  const entry = active;
  active = null;
  restartRequired = false;
  entry?.store.close();
}
