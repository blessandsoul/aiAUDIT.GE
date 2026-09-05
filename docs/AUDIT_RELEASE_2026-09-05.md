# aiAUDIT release acceptance — 2026-09-05

## Implemented

- Content-sized mobile composer and wrapping footer; compact label on small screens.
- Scrollable height-bounded contact dialog and non-overlay mobile consent notice.
- Native dictation now appends finalized speech once, reports permission/errors,
  stops at 60 seconds and never sends the transcript automatically. Response policy
  permits same-origin microphone access; browser/language support still varies.
- Thinking toggle reaches the provider as reasoning_effort high (normal: low).
  Exact-choice/control answers remain deterministic and need no model call.
- Two identical unrecognized answers leave an information gap instead of looping.
- Bounded Instagram/Facebook collection through Apify, with source text, URL,
  run/dataset/receipt identifiers. These are provider records, not independently
  verified originals. Website text and owner testimony remain separate.
- POST scan returns 202; client polls an opaque job until completion. Jobs live in
  one Coolify Node process (not suitable for stateless/multi-replica hosting).
- Persistent per-profile locks, two-hour cache and daily maximum reservations.
  $0.24 reserved per network, default $1/day across the deployment volume; actor
  caps $0.06 posts + $0.18 comments. Reservations are not actual invoices.
- Never automatically unlock uncertain paid requests. Inspect provider receipts
  before operator recovery. No token or full raw dataset is stored in the repo.

## Observed local evidence

- 47/47 unit/source/security tests passed, including finalized speech deduplication.
- Production build passed (40 pages). Earlier font fetch failed transiently;
  retry succeeded. Build is not proof of browser/device compatibility.
- Live model scenarios: growth -> process_first (10 turns), clinic -> aiCHATS
  pilot (10 turns), influencer attribution -> measurement_first (12 turns).
- Real high-reasoning provider request completed and extracted relevant clinic facts.
- Instagram run b17zPGUlSwWJ27ujK returned 10 accepted post records; dataset
  aH40HAaqzgiSPEDcX. Comment run RPVTrMYWsMzwvd2IP returned no_items records:
  ZERO comment text was accepted. This does NOT prove an absence of comments.
- New scan job API: POST 202 -> GET 200, 10 cached posts, 4 validated quotes,
  signed state, no additional provider collection for the cached profile.
- Earlier 320px geometry showed all composer controls inside its border after
  the layout repair. Final full viewport matrix is not accepted: CUA transport
  disconnected during the final pass. Physical microphone audio is untested.
- Fleet live fixture initially looped, then exposed missing fixture coverage for
  a discovery question. Repeated-answer and explicit unavailable-fleet routing
  received regression tests; the complete live fleet fixture remains to re-run.

## Remaining acceptance

Full rendered mobile/landscape matrix, physical dictation on supported target
phones, nonempty comments end-to-end, Facebook end-to-end and live release checks.
Do not label this as a comprehensive social sentiment audit: the model currently
selects business-context quotes, not a representative sentiment/revenue analysis.
Evidence snapshots persist until an operator-managed retention policy is approved;
do not collect private messages or unnecessary customer records.

Deployment outcome is recorded separately after observing the actual rollout.
