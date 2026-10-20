# Verification: decision sandbox and Outpost 01

19 October 2026. Tested in the existing Windows checkout, using bundled Node.js 24 and the existing dependency lockfile.

**Story:** choose an audience and assumptions → inspect published aggregate evidence → submit a field-brief enquiry → confirm email → record customer-approved scope/quote → complete reviewed work → send a requested completion message. Separate confirmed topic choices drive evidence and site updates.

| Boundary | Evidence | Result |
| --- | --- | --- |
| Regression suite | 64 tests, including all 17 original routing tests | Pass |
| Production compilation | Next.js 15.5.27 optimized build and type validation | Pass |
| Browser / calculators | Distributor, financial-institution and research explorers; 25-person support scenario updates to ₦1,250,000 and 50 follow-up slots; invalid input disables enquiry | Pass |
| Browser → API → local store | Synthetic enquiry POST 202; captured finance assumptions; explicit confirmation POST 200 | Pass |
| Scope and completion | Authenticated operator scope approval, then completion message in simulated local outbox | Pass, no real email |
| Notification flow | Confirmed site-only subscriber, one published synthetic site update, worker queues/accepts exactly one simulated message | Pass |
| Removal | Contact removal stops queued messages; tests cover queue purge and no retry after removal | Pass |
| Access controls | Unauthenticated operations and worker each return 401 | Pass |
| Production unconfigured behavior | Email status unavailable; submit returns 503; evidence says snapshot with 87 eligible observations | Pass |
| Longitudinal integrity | Initial point only, empty future positions; synthetic panel tests verify paired denominators and editorial gate | Pass |
| Mobile/browser | 390px viewport: document width 375px, no horizontal overflow; labelled controls and browser console without errors | Pass |
| Actual Sheets server connection | Service-account environment absent | Not activated |
| Real Redis/Resend delivery | Credentials/domain absent; REST adapter and service tested locally | Not verified in deployment |
| Hosting access | Vercel connector returns 403 for Malokun Labs team; no Vercel CLI available | Blocked |

No production source records were edited. Synthetic enquiries and messages stayed in the ignored local test store. No real recipient was emailed and no paid fieldwork was commissioned. GitHub/Vercel checks must be reported separately from these local checks. See `outpost-operations.md` for launch prerequisites and `product-critique.md` for next priorities.
