# Deep Process Audit — 8 September 2026

## Subsequent repair — current local behavior

The 100-case results below are historical, not acceptance of this updated version. The previous free-text permission field could describe future approval while readiness was reported as ready. It now uses approved/pending/denied; reviewer capacity uses available/unavailable. Only approved permission and allocated capacity permit Deep readiness. Old free-text state values require reconfirmation rather than automatic promotion.

Explicit inapplicability closes optional gaps (personal data, handoff, peaks, seasonality, dependencies, error consequence), but cannot authorize access or reviewer capacity. Progress, report gaps and completion reason use this distinction consistently.

Deep selects 8 fields for advertising measurement/attribution, 10 for growth/approval/expert/unique-work diagnostics, none for minor/no-impact or unavailable/discovery cases, and the full set for remaining implementation branches. This is branch-adaptive, not an independently optimized information-gain policy.

The report groups sourced answers into three ordered steps: preparation, bounded comparison, control/stop. Missing details are explicitly marked; non-pilot outcomes prohibit starting an AI pilot. This remains a server-generated plan with client testimony, not independent consultancy findings.

Verification: 146/146 tests and TypeScript passed; targeted lint and low-memory webpack build passed. Real-model readiness checks: 12/12 EN/RU/KA single-turn cases (`artifacts/audit-check/readiness-1788820781025`). Four complete model dialogues: 101 turns, 4 expected outcomes, zero automatic findings (`artifacts/audit-check/hundred-1788820818805`): pilot 33, no-owner prepare 33, measurement-first 13, expert process-first 22. Positive fixture now explicitly states already-granted permission; historical receipts remain unchanged. The final completion-reason consistency edit was unit/typechecked after those dialogues.

No production deployment. Native Georgian full-conversation acceptance and broader adversarial semantic evaluation remain open.

## Scope

Local implementation only. Quick retains its 24-turn limit. Deep supports up to 40 turns for ONE selected process; this is not the complete company-wide paid Deep roadmap described in the original product vision. There is no minimum conversation length and no padding to reach 30 turns.

Deep adds 22 evidence-backed fields covering process boundaries, exceptions, handoffs, authoritative records, data quality, permissions, retention, personal-data categories, workload peaks, hands-on time, error consequences, seasonality, dependencies, adoption, rollback, test scope, target, stop criteria, baseline period and review capacity. Missing Deep evidence prevents a product recommendation and marks readiness limited. Answers remain client testimony, not independent verification.

Mode is included in signed state. The API rejects switching an existing session. The initial UI selector and source scanner preserve the selected mode. Existing sessions without a mode remain Quick.

## Completed evaluation

100/100 completed, 3,262 audit turns, no provider halt. All 100 matched the predeclared verdict/product expectations and passed the limited automatic evidence/action/loop checks. The separate final evidence-ID and Deep-report review also flagged zero cases.

90 conversations took 30–40 turns. Ten advertising-measurement conversations took 26–29; they were not artificially extended. Outcomes: 53 pilot, 7 prepare, 5 insufficient evidence, 10 measurement first, 25 process first. Thus 47 cases did not recommend a product purchase.

All five frozen engine/report/extractor/question-bank hashes were compared with the final local files. The model loop did not change during the run. Receipts include `summary.json`, all 100 numbered transcripts and `deep-review.json` in the directory below.

Frozen run: `artifacts/audit-check/hundred-1788819449997`.

100 unique niche names, eight process archetypes: chats 15, calls 15, documents 20, content 15, data transfer 10, approvals 10, advertising measurement 10, professional safety decisions 5. Customers use scripted English answers; the actual configured model extracts facts and selects the next unresolved field. This is NOT 100 human customers, not 100 independently designed industry workflows, and not an HTTP/browser/Georgian-language acceptance test.

Expectations and source hashes are saved before execution. Each receipt retains actual inputs, extraction, resulting state and report. Automatic checks cover expected verdict/product, missing branch-specific action, provenance and loops. They do not establish diagnostic accuracy, commercial value or integration feasibility.

Preflight: one veterinary scenario completed in 33 turns without automatic findings. It exposed duplicate report evidence, subsequently removed before the 100-case run. The preliminary receipt is `artifacts/audit-check/hundred-1788819190306`.

Local tests: 142/142 passed; TypeScript and targeted ESLint passed. Final low-memory webpack build passed after the UI selector change, 40/40 pages.

After the Deep lead labels were added, TypeScript caught a nullable state access; it was fixed with optional access. TypeScript and the final webpack build then passed. Local HTTP mode tests passed: invalid mode rejected, signed Deep state, switch and tamper rejected, unknown answer preserves Deep. No lead was sent.

Headless Chrome checked the initial selector at widths 320, 390, 768 and 1440 px with no horizontal overflow. The 320 px screenshot was visually inspected. A real local HTTP turn returned 200 and signed Deep state; the selector disappeared after session start. Receipt: `artifacts/audit-check/deep-browser/receipt.json`. This is not a full 40-turn browser run or a physical-device test. The desktop browser connector was unavailable (transport closed); the check used the existing local Playwright installation.

## Remaining acceptance

- The 100-case run and all automatic reviews are complete; independent qualitative acceptance remains open.
- Check negative statements inside free-text readiness fields: a filled field is not proof of authorized access or viable reviewer capacity.
- Independently assess usefulness and sector-specific correctness, including native Georgian conversations.
- Verify a complete long conversation and source-scanner mode propagation in a browser; initial selector and one actual HTTP turn are checked.
- No deployment, real lead submission or scraping is part of this test run.
