# Private aiAUDIT history — release operations

## Archived separate-service candidate —26October2026

The owner cancelled the separate-service architecture and directed that the
engine and encrypted history move into the existing iAI application. This
branch preserves the source and its regressions for recovery only; do not
merge it into a deployment branch or enable this provider. The active successor
is `iai.ge_project/src/features/aiaudit/server/core` with same-process routes.
The operational material below describes this archived candidate, not the
new iAI deployment.

Status: implemented release candidate, **disabled by default**. Local fixture
verification does not authorize enabling this service or selecting retention.

## Local Linux acceptance,26October2026

The pinned official Node24.18.0/npm11.16.0 Alpine filesystem was independently
digest-verified and exercised in an isolated Linux chroot/PID/mount/network
rehearsal. Provider269tests passed with no skips as UID1001; production build380
passed. The separate `npm run test:audit:posix` supervisor proved true ownership
denial503before initialization, unchanged database SHA256/size, and recovery of
the same record/modes. Its root supervisor changes only a fresh validated
temporary fixture; store operations run in UID/GID1001children. The image builder
now runs audit and POSIX suites before compilation. Seventeen actual compiled
provider+iAI BFF TLS/JWT/restart/isolation/import/delete checks passed using
synthetic identity and no external network/models. This does not establish final
Docker assembly, Coolify volume/configuration or real-account acceptance.

## Assembly

Requires the pinned Node24.18.0/npm11.16.0 runtime. Builtin SQLite is a release-
candidate Node API; the actual Linux/musl container and mounted volume still need
acceptance. One provider process owns the SQLite database. Do not horizontally
replicate independent SQLite copies or promise global rate limits.

Canonical iAI must first ship the distinct `aud=aiaudit` issuer branch and add
`aiaudit` to its explicit audience allowlist. Existing aiSTAFF/aiRADAR identity
branches are not an automatic audit admission. Tokens contain only signed actor,
management account and `audit:read`/`audit:write` scopes, with at most300seconds TTL.
The browser talks only to the iAI same-origin BFF. Never forward iAI cookies to
this provider or put any encryption/signing/model secret in `NEXT_PUBLIC_*`.

Runtime provider variables (set through the secret/config manager, not Git):

| Variable | Requirement |
| --- | --- |
| `AUDIT_HISTORY_ENABLED` | `false` until all release gates close; explicit `true` to enable |
| `AUDIT_HISTORY_STORAGE_DIR` | Absolute existing persistent directory writable by UID1001; default `/app/audit-data/history` |
| `AUDIT_HISTORY_KEYS_JSON` | JSON map of one to four key IDs to canonical base64-encoded random32byte AES keys |
| `AUDIT_HISTORY_ACTIVE_KEY_ID` | Existing map key,1–32ASCII alphanumeric/underscore/hyphen characters |
| `AUDIT_HISTORY_RETENTION` | Owner approved `owner_delete` on26October2026; explicit runtime value still required, no automatic enablement |
| `AUDIT_HISTORY_IDP_ISSUER` | Default `https://api.iai.ge` |
| `AUDIT_HISTORY_JWKS_URL` | Default `https://api.iai.ge/.well-known/jwks.json`, same HTTPS origin as issuer |
| `AUDIT_SESSION_SECRET` | Separate random signing secret, use at least32characters; do not reuse an AES key |

The runtime creates only `aiaudit-history-v1/history.sqlite` beneath the configured
parent. It must never chmod the broad parent directory. Supported POSIX checks
require the private directory/file modes; Windows checks do not establish this.
Preserve the SQLite database plus its WAL/SHM as one operational database, not
independent arbitrary file copies. Verify a supported SQLite-consistent backup
and restore procedure before claiming recovery. No backup or destructive cleanup
job is automatically configured by this implementation.

## Retention and deletion

Timed policies deny expired records on read/replay/mutation. `purgeExpired()` is
an explicit maintenance primitive, **not an installed scheduler**. Timed retention
must not be enabled before a bounded maintenance invocation and observability
are implemented/verified. Define backup retention and deletion behavior too.
Logical deletion removes the active encrypted payload and fences old requests;
it does not promise forensic erasure from WAL, backups, disks or crash snapshots.
Content-free protective request receipts/tombstones have explicit capacity caps.

## Rotation / rollback

Add a new random key under a new ID; retain all old key IDs needed by persisted
records and backups. Change the active ID and restart the process. New revisions
use the new active key; old records are not eagerly rewritten. Missing keys fail
closed. Removing a needed key makes its records unreadable, not safely migrated.
Live config/key changes return restart-required rather than mixing runtimes.

For rollback disable the iAI BFF flag first, then provider flag; preserve the
encrypted volume and keyring. Disabled mode does not upload, delete or silently
promote browser-local history. Never launch an older binary against a new schema
without compatibility verification. Do not clear the volume to fix a startup error.

## Acceptance before enablement

- Actual image on Linux/musl, UID1001 mounted permissions and restart persistence.
- Real canonical issuer/JWKS, audience allowlist and current authenticated user.
- Complete interview, report, correction, metadata save, reload, second account
  denial, explicit unverified import, deletion and clear, using the deployed BFF.
- Chosen retention/privacy policy, key recovery, backup/restore and deletion scope.
- Native Georgian/business-owner usefulness acceptance; unit counts are not ROI.

Synthetic local tests use real crypto, store, service and HTTP boundaries, with
explicitly injected fixture extraction. Production runtime has no test-model or
authentication-bypass flag. A fenced single committed turn does not guarantee
exactly-once model charges after crashes or lease expiry.
