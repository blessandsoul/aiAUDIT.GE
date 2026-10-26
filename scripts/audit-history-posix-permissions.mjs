import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  chownSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PRIVATE_TMP_ROOT = '/tmp';
const TEMP_PREFIX = 'aiaudit-posix-';
const FIXTURE_UID = 1001;
const FIXTURE_GID = 1001;
const ROOT_UID = 0;
const ROOT_GID = 0;
const CASE_ID = 'posix-permission-case';
const PRINCIPAL = Object.freeze({ userId: 'fixture-owner', accountId: 'fixture-account' });
const KEYRING = Object.freeze({
  activeKeyId: 'synthetic',
  keys: new Map([['synthetic', new Uint8Array(32).fill(0x52)]]),
});

function fail(message) {
  throw new Error(`POSIX audit-history permission fixture: ${message}`);
}

function requirePosix() {
  if (process.platform === 'win32' || typeof process.getuid !== 'function' || typeof process.getgid !== 'function') {
    fail('must run on a POSIX host with numeric UID/GID support');
  }
}

function requirePhase(value) {
  if (value !== 'seed' && value !== 'denied' && value !== 'recover') fail(`unknown child phase: ${value ?? '<missing>'}`);
  return value;
}

function tempRoot() {
  const root = realpathSync(PRIVATE_TMP_ROOT);
  const info = lstatSync(root);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('temporary root is not a real directory');
  return root;
}

function validatePrivateDirectory(value, expectedRoot = tempRoot()) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) fail('fixture directory must be an absolute path');
  const directory = path.resolve(value);
  if (path.dirname(directory) !== expectedRoot || !/^aiaudit-posix-[A-Za-z0-9]+$/u.test(path.basename(directory))) {
    fail('fixture directory is outside the private temporary prefix');
  }
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) fail('fixture directory is not a real directory');
  if (realpathSync(directory) !== directory) fail('fixture directory resolves through a symlink');
  return directory;
}

function databasePath(directory) {
  const database = path.join(directory, 'history.sqlite');
  if (path.dirname(database) !== directory || path.basename(database) !== 'history.sqlite') {
    fail('database path escaped the private fixture directory');
  }
  return database;
}

function validateDatabaseFile(database) {
  const info = lstatSync(database);
  if (!info.isFile() || info.isSymbolicLink()) fail('database fixture is not a regular file');
  return database;
}

function optionsFor(database) {
  return { path: database, keyring: KEYRING, retention: 'owner_delete' };
}

function snapshot(database) {
  const bytes = readFileSync(database);
  return Object.freeze({
    size: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

function runAsFixtureUser(phase, directory) {
  const result = spawnSync(process.execPath, [SCRIPT_PATH, phase, directory], {
    uid: FIXTURE_UID,
    gid: FIXTURE_GID,
    env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' },
    encoding: 'utf8',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`${phase} child exited ${result.status ?? 'without a status'}: ${result.stderr || result.stdout}`);
  }
  const lines = result.stdout.trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length === 0) fail(`${phase} child produced no receipt`);
  try {
    return JSON.parse(lines.at(-1));
  } catch (error) {
    throw new Error(`${phase} child receipt was not JSON: ${error.message}`);
  }
}

async function childMain(phase, directory) {
  requirePosix();
  if (typeof process.getuid !== 'function' || process.getuid() !== FIXTURE_UID || process.getgid() !== FIXTURE_GID) {
    fail(`${phase} child must run as UID/GID ${FIXTURE_UID}/${FIXTURE_GID}`);
  }
  const privateDirectory = validatePrivateDirectory(directory);
  const database = databasePath(privateDirectory);
  const { HistoryStore } = await import('../src/lib/audit-history/store.ts');
  const { HistoryError } = await import('../src/lib/audit-history/types.ts');

  if (phase === 'denied') {
    validateDatabaseFile(database);
    assert.throws(
      () => new HistoryStore(optionsFor(database)),
      (error) => error instanceof HistoryError && error.status === 503 && error.code === 'AUDIT_HISTORY_STORAGE_FAILURE',
    );
    console.log(JSON.stringify({ phase, uid: process.getuid(), gid: process.getgid(), denied: true, status: 503, databaseUnmodified: true }));
    return;
  }

  const store = new HistoryStore(optionsFor(database));
  try {
    if (phase === 'seed') {
      const created = store.create(PRINCIPAL, {
        requestId: 'fixture-create',
        expectedGeneration: 1,
        id: CASE_ID,
        title: 'POSIX permission fixture',
        mode: 'quick',
        language: 'en',
      });
      assert.equal(created.envelope?.record.id, CASE_ID);
      assert.equal(created.envelope?.revision, 1);
    }
    const readback = store.get(PRINCIPAL, CASE_ID);
    assert.equal(readback.record.id, CASE_ID);
    assert.equal(readback.revision, 1);
    assert.equal(readback.record.title, 'POSIX permission fixture');
    assert.equal(store.list(PRINCIPAL).items.length, 1);
    assert.equal(statSync(privateDirectory).mode & 0o777, 0o700);
    assert.equal(statSync(database).mode & 0o777, 0o600);
    console.log(JSON.stringify({ phase, uid: process.getuid(), gid: process.getgid(), caseId: readback.record.id, revision: readback.revision, directoryMode: '0700', databaseMode: '0600' }));
  } finally {
    store.close();
  }
}

function supervisorMain() {
  requirePosix();
  if (process.getuid() !== ROOT_UID || process.getgid() !== ROOT_GID) {
    fail('supervisor must run as root so the fixture can change ownership');
  }

  const root = tempRoot();
  let directory;
  try {
    directory = validatePrivateDirectory(mkdtempSync(path.join(root, TEMP_PREFIX)), root);
    const database = databasePath(directory);
    chownSync(directory, FIXTURE_UID, FIXTURE_GID);
    chmodSync(directory, 0o700);
    const seeded = runAsFixtureUser('seed', directory);
    assert.equal(seeded.uid, FIXTURE_UID);
    assert.equal(seeded.gid, FIXTURE_GID);
    validateDatabaseFile(database);
    const beforeDenied = snapshot(database);

    chownSync(directory, ROOT_UID, ROOT_GID);
    chmodSync(directory, 0o755);
    chownSync(database, ROOT_UID, ROOT_GID);
    chmodSync(database, 0o600);
    const denied = runAsFixtureUser('denied', directory);
    assert.deepEqual(denied, {
      phase: 'denied',
      uid: FIXTURE_UID,
      gid: FIXTURE_GID,
      denied: true,
      status: 503,
      databaseUnmodified: true,
    });
    assert.deepEqual(snapshot(database), beforeDenied);

    chownSync(directory, FIXTURE_UID, FIXTURE_GID);
    chmodSync(directory, 0o700);
    chownSync(database, FIXTURE_UID, FIXTURE_GID);
    chmodSync(database, 0o600);
    const recovered = runAsFixtureUser('recover', directory);
    assert.deepEqual(recovered, {
      phase: 'recover',
      uid: FIXTURE_UID,
      gid: FIXTURE_GID,
      caseId: CASE_ID,
      revision: 1,
      directoryMode: '0700',
      databaseMode: '0600',
    });
    assert.equal(statSync(directory).mode & 0o777, 0o700);
    assert.equal(statSync(database).mode & 0o777, 0o600);
    console.log(JSON.stringify({
      pass: true,
      platform: process.platform,
      supervisorUid: process.getuid(),
      fixtureUid: FIXTURE_UID,
      deniedStatus: denied.status,
      databaseUnmodified: denied.databaseUnmodified,
      recoveredCaseId: recovered.caseId,
      recoveredRevision: recovered.revision,
      directoryMode: '0700',
      databaseMode: '0600',
    }));
  } finally {
    if (directory !== undefined) {
      const validated = validatePrivateDirectory(directory, root);
      rmSync(validated, { recursive: true, force: true });
    }
  }
}

const phase = process.argv[2];
if (phase === undefined) {
  supervisorMain();
} else {
  await childMain(requirePhase(phase), process.argv[3]);
}
