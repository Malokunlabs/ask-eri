# Ask ERI V0

Standalone Next.js 15 application styled to complement useeri.com. Public answers contain aggregate evidence only. An optional server-side, read-only Google Sheets connection feeds an analysis stage before results are published.

## Local run
Use Node.js 24 (the tested local runtime), then `npm ci && npm run dev`.

Without server credentials, the app displays the committed validated snapshot. It never labels that snapshot as a live feed. To enable automatic sheet reads, follow [Live evidence and analysis](docs/live-evidence.md) and configure the two server-only variables in `.env.example`.

`npm test` runs the routing, analysis, publication and refresh regression tests. `npm run build` checks the production build without needing Google credentials.

## Vercel deployment
Import this folder into a Vercel project (framework Next.js). For a separate project, attach `ask.useeri.com` after verifying the domain is available in the owner's Vercel team. Alternatively, integrate the `app` and `lib` code into the existing website under `/ask` (move the page to `app/ask/page.tsx`, scope styles appropriately, and merge metadata).

## Editorial updates
The current aggregate snapshot is `data/evidence-snapshot.json`, analysed from the supplied source on 20 October 2026. It includes all 115 initial observations dated 7–16 October 2026: 27 identity-review observations are included with warnings, and one shifted row is recovered from its actual source answers. See `docs/evidence-review-2026-10-20.md` for this approved inclusion policy. Identities are provisional: these are not verified unique business counts. The historical 10-record pilot is not added to the cohort.

`lib/analyze.ts` validates schema, dates, duplicate submissions, observation type, response categories and denominator reconciliation. `lib/publish-evidence.ts` extracts signals through fixed aggregate templates; unrecognised and contradictory answers are excluded from each signal's denominator. Signals with fewer than 10 classifiable responses are withheld. Published figures must come from this analysis; retain dates, denominators and limitations. Review source/schema changes before changing the rules.

`/api/evidence` reads only allowlisted source columns on the server through a read-only service account and returns aggregate results. The open page refreshes every minute. If access or validation fails, it clearly shows the last validated analysis; a cold instance falls back to the committed snapshot. Names, contact details, photographs and open notes are not requested or sent to visitors. See the analysis guide for exact field rules, denominators, credential setup and refresh limitations.

## Product scope
- Conservative natural-language keyword matching over six supported signal templates
- Evidence counts, context and limitations
- Honest refusal for out-of-scope questions
- Responsive UI with ERI's burnt-orange/serif visual language
- An analysis and data-quality stage before publication
- Optional private Google Sheets reads and automatic aggregate refresh

## Before public launch
- Verify each metric against signed-off dataset
- Obtain editorial/legal approval for published findings
- Add privacy policy and analytics with consent as appropriate
- Confirm accessible brand treatment and QA across browsers
- Activate requested email only after provider/privacy review and deployed delivery tests
- Set up CI and source control in the owner's actual Vercel team

No LLM API key is needed. General Ask ERI questions are not persisted. Explicit field-brief enquiries retain the submitted contact details, question and scenario under the stated privacy and retention terms.


## Multi-location readiness
`lib/source-schema.ts` defines the source cohort and allowlisted fields. The current form has no per-row market field; geography is configured as Yaba–Sabo–Tejuosho, Lagos. Add a location only after its geographic mapping and aggregate findings are reviewed. All public answers must be scoped to a source cohort; do not reuse Lagos results for a new city. The app contains one active market cluster and no cross-market comparisons.

## Decision sandbox and Outpost 01
Three evidence-informed planning explorers, quote-first field-brief enquiries, confirmed topic notifications and a longitudinal watch are included. Production email stays unavailable until configured; development uses a labelled local outbox. No forecast or unobserved trend is invented. See [operations and activation](docs/outpost-operations.md) and [product critique and next priorities](docs/product-critique.md).

The homepage leads with a distributor market brief and supported questions. A fixed aggregate edition is at `/briefs/yaba-2026-10-20`; `docs/offline/interview-kit.html` is a standalone offline interview worksheet (not a site route) and `/operations` provides the protected fulfilment workspace. See [decision-led handoff](docs/decision-led-handoff.md) for owner responsibilities and activation limits.
