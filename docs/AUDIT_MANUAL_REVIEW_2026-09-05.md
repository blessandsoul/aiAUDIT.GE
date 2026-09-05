# Live conversational review — 2026-09-05

Three synthetic customers completed 12 turns each against the public https://aiaudit.ge/api/ai-intake endpoint. The reviewer read each question and wrote a natural response; no predefined BANK answers or expected-field fixture was used. No contact forms or leads were submitted. This tests the live conversation endpoint, not browser layout. Production was not changed during the review.

## Results

1. Russian dental clinic: 80 daily messages, evening delays, two lost appointments, existing FAQ, reviewer and baseline. Appropriate aiCHATS pilot after 12 turns. Useful intake for sales/discovery. Report nevertheless proposes a generic channel/task and asks for baseline despite the supplied evening baseline of 90 enquiries and 11-hour response time. It does not turn the specific medical/human boundary into a tailored pilot plan.
2. Georgian handmade-bag shop: 5–10 daily Instagram enquiries, low reach, fast replies. First question asks what calls are for. Two explicit corrections that calls do not exist fail to change focus. Final report avoids selling a product but recommends a call-confirmation scenario and call metrics. Business value is poor and guidance is inapplicable.
3. Russian B2B consulting: uncertain AI need and no measurements. Mention of documents prematurely routes to docs; objection successfully redirects to growth. Asked about business impact, reviewer answers “А какая завтра погода в Тбилиси?”. Final report includes that sentence as [impact:9], confirmed. “Не знаю, мы их не спрашивали.” is also displayed as evidence for loss_reason. No-product conclusion is reasonable, but evidence integrity fails.

## Reproduced mechanisms

- `focusHint` matches Georgian substring `ზარ` inside `გავზარდო` (grow/increase), incorrectly routing a growth statement to calls. First-turn hint can override the model's correct growth classification.
- Once a specific focus and pain exist, focus-switch conditions prevent recovery from explicit corrections in the shop case.
- The open-question fallback confirms arbitrary text of six or more characters when extraction is missing/partial. It explicitly promotes the weather question to impact, and can convert natural-language uncertainty into confirmed evidence. This was introduced in bf35fdd and is a regression, not a model-only error.
- Report actions are selected by focus even when recommendation verdict is process_first and the customer denies that process exists.

## Verdict and priority

Useful for preliminary lead context on a cooperative, clearly scoped case. Not reliable enough to claim a trustworthy autonomous business audit. Of these three qualitative cases, one gives an applicable pilot direction, one gives an inapplicable action plan, and one contaminates evidence. These counts are not a statistical accuracy estimate.

Fix evidence admission, linguistic routing and explicit correction recovery before adding more product logic or Deep Audit. Re-run these exact transcripts and fresh unscripted cases after repairs. Existing 24 passing unit tests did not cover the observed failures.

Raw local transcripts (synthetic data, including signed session state): `%TEMP%/aiaudit-review-20260905/{clinic,shop,vague}.json`. Replay helper: `scripts/audit-manual-review.mjs`. Do not publish raw signed state.

## Repair verification

The arbitrary open-answer confirmation fallback has been removed. Partial remains partial, natural uncertainty remains unknown, and an unrelated turn creates no progress/evidence. Routing hints no longer override a meaningful growth diagnosis or select a domain merely mentioned during discovery. Georgian call matching has token boundaries. An explicit change of process can override a previously established focus; earlier process-specific evidence/attempts are cleared and cross-process contradictions are not reused.

Growth and attribution stop asking generic implementation-readiness questions when no AI implementation is indicated. Reports now expose the customer's pain, impact, baseline and human responsibility before the evidence appendix, propose a supported channel, and use the existing baseline. Growth gets a seven-day measurement-and-one-change plan; B2B gets meeting/proposal/reply metrics. No-product results no longer prescribe an AI call pilot. Old signed sessions must restart because they may contain contaminated facts.

Verified locally with the real configured provider: clinic 12 turns → aiCHATS with stated evening baseline/human boundary; Georgian shop 8 turns → growth plan/no product; uncertain consulting 14 turns → no product, weather excluded and impact remains a gap. The consulting run included one extra systems answer during an intermediate build; count is not a duration target. Separate two-turn live-model correction check changed calls → growth and removed the earlier process's evidence. 29/29 unit tests passed; TypeScript and production build passed (39 pages); lint has only the pre-existing unused setter warning. Browser verified actual choices, mobile width, early limited report, PDF and optional unchecked consent; no lead sent. These are bounded regression results, not population-level diagnostic accuracy.
