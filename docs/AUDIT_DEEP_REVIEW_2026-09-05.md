# Deep behavioral review — 2026-09-05

Verdict: meaningful improvements exist, but diagnostic acceptance FAILS.
Tested the local release build with the real configured model, not mock replies.
95 HTTP requests: 90 in the bounded scenario run and 5 independent branch probes.
No lead submissions, Apify collection, production writes or application-code fixes.
The existing 48 unit tests still pass; they miss the defects below.

## Scenario results (manually reviewed beyond automated assertions)

| Scenario | Turns | Observed outcome |
| --- | --- | --- |
| RU artisan, no significant bottleneck | 22 | FAIL: repeated area question; no report within test horizon |
| EN prompt injection, then unknown replies | 22 | Role isolation passes; interview loops at area |
| EN ads without tracking/data/owner | 13 | No inappropriate product; usefulness FAIL: generic advice ignores concrete measurement gap |
| KA low-volume shop | 10 | Useful process-first funnel test, no product |
| KA clinic, repeated messages and delays | 10 | Evidence-bound aiCHATS pilot |
| KA influencer attribution | 12 | Measurement-first, no premature product |
| KA calls | 1 | NOT EVALUATED: 90-request budget reached |

Ads/office positive fixtures were not run. Synthetic fixtures are not independent
expert ground truth or evidence of actual customer/pilot results. Negative cases
responded honestly with unknown to unanswerable follow-ups, not invented data.
Raw harness labels four results PASS because its assertions check safety/verdict,
not full usefulness; manual review rejects one of those four (no_tracking_en).

## P1 — Numeric contradiction silently overwrites evidence

Initial clinic: 200 Instagram messages/day. Later: 800 messages/day, with no
correction or different period/channel. New scale became confirmed, old value
was lost, and no clarification was asked. Repeated against the completed clinic
audit: report remained complete, aiCHATS pilot/supported/ready, scale 800 confirmed.
This is NOT proof the product choice itself is wrong; evidence integrity is wrong.

Mechanism: src/lib/audit-engine.ts conflict detection requires options.length > 0.
Free-text quantitative fields therefore depend on the model voluntarily flagging
contradictions. Exact quote matching cannot establish consistency or truth.

## P1 — Discovery cannot finish naturally when no process fits

The artisan explicitly reports five enquiries/week, five-minute responses,
unique orders, no recurring workload or delays. After unknown area answers the
same area question repeats through turn 22. The hard maximum can eventually
stop the audit; this test does not claim an infinite loop.

Mechanism: ready requires focus != discovery, while an empty missing list falls
back to area. Exhausted unknown fields do not produce a timely limited/no-AI result.

## P2 — Safe refusal is not necessarily useful advice

The furniture shop explicitly cannot attribute purchases to campaigns, has no
tracking or implementation owner. After 13 turns the report gives generic case
review advice, not a targeted measurement-first action. Pain was omitted by
extraction; assess returns insufficient before the tracking-specific rule.
The anti-sales check passes, but the report wastes known diagnostic information.

## Branch probes

- Explicit correction 200 -> 20, hours -> minutes, real issue low reach: growth
  route selected, corrected scale retained. PASS for this specific response.
- Weather/poetry during impact: no weather answer, original scale retained,
  same diagnostic question. PASS; language switched to English without reset.
- Synthetic password: HTTP 400. PASS; no real secret used.
- Both silent numeric replacement probes: FAIL as described above.

## Evidence and next verification

Raw transcripts: artifacts/audit-check/deep-1788628095662/*.json; summary.json
and branches.json. Completed-report contradiction response was observed directly
in tool output: turn 11, scale:11=800 confirmed, complete=true, pilot aiCHATS.
Runner scripts: audit-deep-check.mjs and audit-deep-branches.mjs. The scenario
runner was subsequently hardened to stop repeated questions early and not start
a new case without its full request allowance; original receipts are unchanged.

Repair and re-run the three defects first, then expand positive product coverage,
Georgian language quality, multi-turn contradictory metrics and physical-device
acceptance. No statistical precision/recall estimate can be inferred from this sample.
