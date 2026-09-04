# Quick Audit v2 — 2026-09-05

## Changed behavior

The old ten-block sales brief is replaced by a focused, evidence-led Quick Audit. A branching question bank owns both the question and its categorical answers in Georgian, Russian and English. The model extracts facts with verbatim latest-message quotes; the server validates structure, enum types, provenance, state signatures, completion and conservative recommendation rules. Semantic extraction still requires model-quality evaluation: JSON correctness alone does not prove factual interpretation.

Branches distinguish growth, influencer attribution, customer messages, calls, ads, content, documents, web processes and operations. No fixed ten-field completion. A field is attempted at most twice, then remains an explicit gap. Users may finish early with a limited conclusion. Unknown and declined remain distinct. A supported pilot requires impact, repeatability, readiness and an inadequate simpler alternative.

Reports contain a conclusion, client evidence, opportunity/readiness, next test, metrics, requirements, risks, gaps and non-recommendations. This release recommends zero or one strongest product for the examined process, not a comprehensive multi-department Deep Audit. Report viewing and text/PDF printing do not require contact. The discussion dialog requires explicit consent and is never opened automatically. State and canonical history are server-signed; this is not encrypted database persistence.

## Local verification

- Production Next.js build: passed, 39 static pages generated.
- TypeScript: passed. Lint: zero errors; one existing unused setter warning in RoiCalculatorWidget.
- Real configured provider, three complete synthetic scenarios: attribution 17 turns → measurement_first/no product; low-reach shop 14 turns → process_first/no product; repetitive clinic messages 10 turns → aiCHATS pilot.
- Exact user transcripts replayed: original 12-answer influencer brief and six-answer shop brief do not falsely finish or establish missing tracking/ownership/baseline evidence. Replaying old answers against new questions is a non-fabrication regression, not a natural conversation quality score.
- Browser: actual UI/API answer-chip equality, mobile overflow check, early limited report, PDF generation, optional unchecked-consent dialog. Screenshots visually inspected. No lead submitted.
- HTTP: rejected foreign origin, long input, obvious secret, legacy and tampered sessions; EN→RU retained facts, explicit unknown stayed unknown.
- Post-deployment browser testing exposed occasional generic-growth routing of an explicit influencer-source question. A multilingual server routing hint now keeps that question in attribution. The hint establishes no business facts or recommendation; the source-recording question is still required.
- Unit coverage: question/answer contracts, provenance, refusals, anti-repetition, partial data, contradictions, readiness, false recommendations and signed-state tampering. Run `npm run test:audit` using Node 24 (or a Node release supporting TypeScript stripping).

## Reproduce

`npm run test:audit`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

Against a running application, set AUDIT_TEST_URL and run `node scripts/audit-live-check.mjs`, `node scripts/audit-replay-check.mjs`, `node scripts/audit-replay-check.mjs shop`, `node scripts/audit-http-check.mjs`. These use real model calls and synthetic/no-contact data. Browser check additionally needs AUDIT_PLAYWRIGHT pointing to an installed Playwright package and a locally installed Chrome.

## Release boundary

Deployment and post-deployment rendered/API checks are separate gates, recorded in the project operational note. No fabricated live-delivery claim from local tests. This is not a claim of perfect diagnosis, native-speaker approval, exhaustive multilingual adversarial coverage, full Deep Audit, CRM persistence, or measured business ROI. Georgian business-language review and a broader expert-labeled company regression set remain necessary for commercial quality calibration. Existing pre-v2 sessions must restart.
