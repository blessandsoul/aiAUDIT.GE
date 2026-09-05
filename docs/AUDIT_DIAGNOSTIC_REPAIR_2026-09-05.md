# Diagnostic repair acceptance — 2026-09-05

## Changes

- Changed numeric values in scale/impact/baseline/conversion cannot silently
  replace a known value. Retain both quotes, mark partial and ask whether this
  is a correction or different periods/processes. Common changes in units and
  messages versus leads also trigger clarification. This is conservative checking,
  not a universal measurement parser: equivalent units may need one clarification.
- Explicit corrections and answers to clarification can resolve the field.
  Unresolved values are excluded from confirmed evidence and strong product fit;
  a limited report lists both statements separately.
- No-pain discovery and exhausted unknown area responses finish without repeating
  area until the hard turn limit. Choosing another process resets old evidence.
- Known missing ad tracking yields measurement_first before the generic missing
  pain gate. Report specifies a test order, source reconciliation, unattributed
  orders and no AI budget control until measurement is verified.
- Session signing generation v4 invalidates old sessions whose evidence may have
  been silently overwritten. Existing conversations must start a fresh audit.

## Verified locally

- 61/61 tests (48 existing + 13 repair regressions), TypeScript and targeted lint.
- Production build passed; final combined deployment build is checked separately.
- Real model replay: no-AI 22+ -> 2 turns/not_now; injection+unknown 22+ -> 5
  turns/insufficient; no-tracking 13 -> 3 turns/measurement_first with test order.
- Growth 10 turns/process_first, clinic 10/pilot aiCHATS, attribution 12/
  measurement_first, calls 13/pilot aiCALL: expected outcomes retained.
- Changed clinic count 200 -> 800 now returns partial with previous quote and
  scale clarification, not confirmed. Explicit correction -> growth/20 confirmed;
  off-topic keeps the diagnostic question; synthetic password returns 400.
- One original ads fixture was correctly refused (business only "online shop",
  partial). A richer business/workflow fixture subsequently passed in 18 turns
  with aiADS. The original negative result is retained, not rewritten as a pass.
- Office follow-up was cut off by the 100/IP/hour local guard (429); no completed
  office result is claimed for this pass. The test stopped, rather than bypassing
  the application rate limit. No leads or Apify jobs were submitted.

## Evidence

- artifacts/audit-check/deep-1788629182145: 70-request main replay + 4 branch probes.
- artifacts/audit-check/positive-1788629335645: 18-turn ads pass, office incomplete.
- scripts/audit-repair.test.mjs: portable deterministic regressions, no external
  source files required. Earlier raw failed transcripts remain untouched.

## Remaining limits

Physical dictation/full mobile matrix, nonempty social comments, broad expert
review and real pilot business outcomes are not established by these checks.
Do not market this release as infallible or as a complete Deep Audit.
