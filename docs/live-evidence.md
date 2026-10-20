# Live evidence and analysis

## Source and current review

The source is the [ERI Merchant Business Observation Form (Version 2.0)](https://docs.google.com/spreadsheets/d/110iYfoI0ejYI7FmLVY_QnMK0PnUQxMp6KEvVM4Zjjtc/edit?gid=0#gid=0), tab gid `0` (currently `Sheet1`). The application does not edit it or change its sharing.

The 20 October 2026 review includes all 115 initial observations dated 7–16 October. The owner requested inclusion of the 27 observations flagged `REVIEW: possible repeat submission`; their answers now contribute to aggregates while their unresolved identity warnings remain visible. One shifted row was recovered from its actual answers using the reviewed +61-column mapping. This is a local reader normalization, not an edit to the private sheet. The `ERI Signals Oct 16` summary tab is not the ingestion source.

These are observations, not verified distinct businesses. No verified longitudinal comparison is published. The original 10-record historical pilot is not added to this sheet's cohort.

## Analysis before publication

1. Read metadata and resolve the source by immutable gid. Read only the column allowlist in `lib/source-schema.ts`. Do not request names, emails, contact details, photos, revenue ranges or open-text notes.
2. Validate the exact header schema. Stop publication when a required header moves or changes, the source is inaccessible, or the grid exceeds 10,000 rows. Never silently truncate.
3. Recover the reviewed shifted layout only when the standard ten observation cells are blank, the BJ marker is a submission UUID, and the shifted ID/type/date reconcile. Read only BJ, BP, BQ, CC, CE, CH, CL, CP, CT and CW at candidate rows. Mark recovered identities provisional and expose only aggregate recovery counts. Missing recovery reads or changed markers stop publication. Ignore blank rows. Require a submission ID, the recognised initial observation type and a real ISO observation date between 7 October 2026 and today in Africa/Lagos. Use the observation date, not the submission timestamp or the workbook's Asia/Tokyo setting.
4. Deduplicate identical submission retries. Hold **all** conflicting copies of a submission. Include REVIEW-flagged observations under the approved observation-cohort policy, count those flags and keep identities unverified. Hold explicit REJECT, EXCLUDE or HOLD flags, including on any duplicate copy. Separate pilot and revisit rows. Provisional merchant IDs do not establish uniqueness; different submission IDs remain different observations.
5. Classify only recognised answers. Separate missing, unknown/unrecognised, contradictory and not-applicable responses. For restocking, require `Yes` to applicability; `No` with an answer is contradictory. A mixed `No records` selection is contradictory. `__other__` is unrecognised. The form's combined `Memory Notebook/paper` option cannot establish written recordkeeping.
6. Check that each field's valid + missing + unknown + contradictory + not-applicable counts equals the eligible cohort, and that category counts sum to its valid denominator.
7. Publish a signal only when at least 10 classifiable responses exist. This is a minimum reporting rule, not a claim of statistical representativeness. Withhold unsupported questions, forecasts, cross-tabs and causal or national claims.
8. Render fixed, neutral answer templates from aggregate counts. Include the observation period, field-specific denominator, exclusions and limitations. Never serialize rows, identifiers, credentials or source API errors.

The current reviewed denominators are:

| Signal | Main count | Valid responses | Answer exclusions from 115 |
| --- | ---: | ---: | --- |
| Transfer is primary | 70 | 114 | 1 don't know |
| Selected no records | 56 | 112 | 1 contradictory, 2 unrecognised |
| Recalled better conditions | 89 | 114 | 1 too new to say |
| Higher restocking expenditure | 85 | 104 | 10 do not restock, 1 don't know |
| Borrowing or supplier credit | 30 | 115 | None |
| Remote orders regularly or sometimes | 56 | 115 | None |

These denominators deliberately differ from the all-submission percentages in the summary tab. In particular, `56/112` describes classifiable recordkeeping responses, not all 115 observations. Higher expenditure is not measured inflation. Better conditions are retrospective recollection, not repeat-visit change.

## Connect the private sheet

1. In a Google Cloud project you control, enable the **Google Sheets API** and create a dedicated service account. This reader needs no broad project IAM role and no domain-wide delegation.
2. Create its JSON key and keep it private. Do not paste the key into chat, commit it, or put it under `public/`.
3. Share only the source spreadsheet with the service account's `client_email` as **Viewer**. Keep general access restricted.
4. Copy `.env.example` to `.env.local`. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL` to `client_email` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` to `private_key` from that JSON key. Escaped `\n` is supported. Configure the same two **server-only** environment variables in the hosting project's intended environment. Never use `NEXT_PUBLIC_` prefixes.
5. Restart the development server, or redeploy the reviewed application on the host after setting its environment. Open `/api/evidence` and confirm `connection.mode` is `live`, with a recent `checkedAt` and the expected counts. The website's source status must also say connected.
6. Verify a genuine authorised source correction is reflected after the next refresh. Do not add fake submissions to the production sheet for testing. The tests use synthetic observations instead.

Google's official [server-to-server authentication guide](https://developers.google.com/identity/protocols/oauth2/service-account) describes credential setup. The code uses Google's `google-auth-library` and only the `spreadsheets.readonly` scope. It uses the [Sheets batchGet API](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet) to request the allowlisted columns from the private sheet.

## Refresh, failures and privacy

The open website polls `/api/evidence` every 60 seconds and on return to the tab. A server process coalesces concurrent requests and reads Google at most once per minute. This is polling, not a push stream; a change can take about two minutes plus request latency to reach a page because server and browser refresh clocks can differ. No background job or cron is needed.

The server holds only the last validated **aggregate** response in memory. On source/auth/schema failures, it serves that result with an explicit stale status and retries after one minute. A cold server instance uses the committed validated snapshot in `data/evidence-snapshot.json`. Memory is not shared between serverless instances; cross-instance durable last-good storage is not configured. The snapshot's `analyzedAt` and observation period always remain visible. Missing credentials are labelled snapshot mode, never live.

The public API returns only counts, quality summaries and templated signals. Source identifiers are used transiently for deduplication. Raw projections used for local review belong in ignored `.local-data/`; keys belong in server environment variables. Neither is part of the commit or browser bundle. The service account must remain Viewer-only even if application code changes.

The cohort location is configured as Yaba–Sabo–Tejuosho, Lagos. This form has no per-row market field. Do not add other markets to this source and assume automatic geographic classification. Add an explicit verified geography field and a reviewed cohort mapping before expanding coverage.

## Reproduce a snapshot review

With a private JSON projection containing exactly the allowlisted `headers` and `rows` in schema order:

```sh
npm run analyze -- .local-data/source.json .local-data/candidate-evidence.json
npm test
npm run build
```

Inspect the aggregate candidate and its exclusions before replacing `data/evidence-snapshot.json`. Commit only that reviewed aggregate output. Never copy the private input into a tracked folder. The analysis command cannot export arbitrary source values; publication templates use only recognised categories and counts.

The cohort expansion is an inclusion-policy and source-layout correction, not economic growth or longitudinal change. Identity-review observations remain excluded from verified panel matching. See `evidence-review-2026-10-20.md`.
