# Outpost 01: field briefs and evidence updates

## What works and what needs activation

Three decision explorers use the same published evidence as Ask ERI. Distributor outputs are purchasing arithmetic; financial-institution outputs are hypothetical pilot budgets; research outputs are planned visit slots and illustrative cost. None is a forecast, lending assessment, ERI price quote or power calculation.

Requests are enquiries, not orders. The service is: submit assumptions and question → confirm email → ERI agrees scope/price/timing → an operator records the customer's approval → agreed fieldwork and editorial review → completion email. There is no payment integration, automatic research fulfillment or invented turnaround promise.

Development uses `.local-data/engagement.json`, a single-process private test store and simulated outbox. No real emails are sent. Production returns 503 unless live configuration is complete. Never enable the file store in production or run multiple development workers against it.

## Activate privately in the server environment

1. Configure the read-only Google service account and sheet sharing described in `live-evidence.md`. Verify `/api/evidence` reports `live`; a committed snapshot is not a current source connection.
2. Provision a Redis-compatible **REST command** endpoint (Upstash Redis supported) with access restricted to the server. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. A raw `redis://` URL alone is not supported.
3. Verify the sending domain in Resend. Set `RESEND_API_KEY` and `ERI_EMAIL_FROM`. Review sender identity, privacy copy, processor agreements and provider retention before enabling collection. Send a controlled test to an owned inbox and check acceptance, delivery, reply handling and unsubscribe; provider acceptance alone is not inbox delivery.
4. Set `ERI_SITE_URL` to the exact HTTPS site origin. Set `ERI_ENGAGEMENT_MODE=live`. Generate distinct random `ERI_OPERATIONS_SECRET` and `CRON_SECRET` values of at least 32 characters. Never use `NEXT_PUBLIC_` or put secrets in Git, command arguments, screenshots or chat.
5. Test confirmation expiry, denied operations, quote approval, report completion, unsubscribe, source failure and delivery retry in the deployed environment before promotion. Review operational ownership and privacy policy. Do not imply payment collection is enabled.

Vercel cron configuration calls the protected worker daily at 08:00 UTC (09:00 WAT). It requires `CRON_SECRET` in the deployment environment. Daily notification processing is deliberate for an initial small audience; the open evidence page still polls every 60 seconds. Notifications are not instant. Increase cadence only after checking the hosting plan, delivery rate limits, queue size and cost. Other hosts must configure an authenticated scheduler themselves.

## Operator commands

Start the development server and open the page first; `/api/engagement` creates a private local operations key. `npm run operations -- list` reads enquiries through the protected operations API. In production set `ERI_SITE_URL` and `ERI_OPERATIONS_SECRET` privately in the operator shell. Do not paste output containing contact details into public issues or PRs. Pagination is available on `GET /api/operations?cursor=...`.

Create a private, ignored JSON file under `.local-data/` with the confirmed request ID. Scope approval example:

```json
{
  "id": "the-request-id",
  "description": "Agreed measures, location, visit windows and reporting deliverable",
  "quote": "Agreed price, payment terms and delivery timing",
  "customerApproved": true,
  "approvalReference": "Reference to the customer's explicit written acceptance"
}
```

Run `npm run operations -- approve-scope .local-data/scope.json` only after that acceptance exists. The operator attests to the approval; the site does not independently verify or collect payment. To deliver, prepare a separate private file with `id` and a plain-text `report` (40–30,000 characters) and run `npm run operations -- complete .local-data/completion.json`. Reports must state actual sources, dates, methods, completed work and limitations. The original scenario is context, not evidence of outcomes. No attachment upload is implemented. An accepted or already queued report cannot silently be replaced.

Run `npm run operations -- work` to process retries and evidence updates. A site update uses a private JSON file with `topic: "site"`, `title` and `summary`, then `npm run operations -- publish-update <file>` followed by `work`. Do not publish unsupported claims. Longitudinal updates are refused unless reviewed matched series are published.

## Delivery and consent controls

- Explicit topic opt-in; a brief enquiry never opts into marketing. All signups require email confirmation within 48 hours. GET confirmation links do not mutate state, avoiding activation by email link scanners.
- Reconfirming a subscription replaces its previous topics; unconfirmed changes do not alter an active subscription.
- Per-client and hashed-email rate limits, bounded JSON, same-origin form submission, honeypot, server validation, protected operations and token-based removal.
- Records: unconfirmed 2 days; enquiries up to 180 days after processing; subscriptions 365 days. Queue/outbox messages 14 days. Removal deletes the contact and its queued/local messages. Provider copies and in-flight accepted messages cannot be recalled. Review backup/processor retention before launch.
- Queue jobs use deterministic IDs, Redis NX locks and Resend idempotency keys. Retries back off, stop after eight failures or 24 hours, and require operator inspection beyond that window to avoid duplicate mail. Inspect failed queue jobs in the private Redis console. There is no bounce/complaint webhook or delivery dashboard yet; these are activation/operational limitations, not proof of delivery.
- Worker scans are paginated. Each run processes one recipient page per update and one job page. At larger scale, add a frequent durable worker, capacity monitoring, provider rate handling and an admin dashboard before promising timely alerts.
- Semantic evidence digests ignore analysis timestamps. Re-reading the same sheet does not generate new signal email. QA revisions are described as revisions, not economic change. No historical backfill is sent when a subscriber joins.

## Longitudinal publication gate

Initial cohort points remain separate from a true panel. There is no forecast line. The analyzer requires verified canonical identities, one initial visit, a later labelled visit, valid dates, no conflicting submissions and at least 10 complete pairs for each outcome. The same businesses supply both round denominators. Only the first two eligible visits are shown in this version; no continuous time-series claim.

Even valid pairs are withheld until `ERI_PANEL_APPROVAL_REFERENCE` records internal sign-off for return-visit consent, matching, comparable instruments, visit windows, attrition and geographic scope. This is an operator approval gate, not automated consent verification. Keep it blank until that review exists. Never populate source rows or future points merely to make the graph move.

## Browser workspace

`/operations` uses the protected operations API in live mode; enter the server operations key only on a trusted deployment. The key remains in page memory, never browser storage. Clear the private view when finished. This workspace records operator attestations, not independent proof of customer approval, fieldwork, payment or inbox delivery.

`/api/local-operations` is development-only, local-outbox-only and loopback-host-only; mutations additionally require the configured same origin. Production returns 404 before initializing local storage. Its seed action creates only a synthetic `.invalid` enquiry, never a cohort observation. Never enable a local bypass in production.
