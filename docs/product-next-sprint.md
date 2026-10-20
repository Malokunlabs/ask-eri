# Next sprint: a decision-led market brief

Implementation contract, 20 October 2026. The decision-led brief, archived aggregate edition, question-led enquiry, illustrative deliverable, offline three-interview worksheet and operator workspace are implemented for testing. Live services and customer demand remain unvalidated. See `decision-led-handoff.md` for owner actions and verification limits.

## User story and placement

As a distributor or procurement lead considering a purchasing or ordering pilot in the configured Yaba–Sabo–Tejuosho cohort, I want a concise dated brief that shows what was observed, what it might mean for my decision, and what ERI would need to verify next, so I can choose a useful investigation.

Place it immediately after the introduction and source/scope indicator, before asking the visitor to type an unrestricted question. Keep access to all supported signals and the existing audience explorers. Primary action: “Investigate this question”. Secondary actions: “Inspect the evidence” and “See what a field brief includes”. Buyer-facing wording must avoid internal implementation terminology.

## Sample brief using only published aggregates

**Yaba–Sabo–Tejuosho field note: questions for a restocking or ordering pilot**

Observations: 7–16 October 2026. Published analysis: 20 October 2026, analysis-v3. Source: ERI Merchant Business Observation Form, reviewed aggregate projection. Coverage is configured at cohort level. 115 initial observations; identities remain provisional, with 27 possible-repeat review flags. This is not a representative market sample or a count of verified distinct businesses.

**Observed:** 85 of 104 classifiable restocking answers report higher expenditure than about three months earlier. Ten observations do not restock and one answer is unknown.

**Possible relevance:** A distributor may want to investigate whether order size, delivery frequency, supplier choice or purchasing cash constrains replenishment. This is a decision hypothesis, not an observed effect or a recommended commercial intervention.

**Still unknown:** How much reflects unit prices, quantities or product mix; which products are involved; current stockouts; margins; preferred delivery terms; willingness to join a pilot.

**Observed separately:** 56 of 115 observations report regular or occasional remote orders. This does not establish that those same respondents also report higher restocking expenditure, or that they want a new ordering tool.

**Next field question:** For a consented group of identity-reconciled businesses in an agreed product category, how do product-level unit costs, order quantities, replenishment frequency and ordering channels operate, and what changes on a later visit?

**Commissionable next step:** Request a scoped field brief. ERI first agrees the exact decision, feasible coverage, measures, permitted use, quote and timing. Existing facts form the baseline; collecting new data and completing follow-up are separate agreed work. No price, sample size, completion date or outcome is promised by this sample.

**Expected deliverable structure:** decision and scope; actual completed fieldwork; dated evidence table; descriptive findings; operational options to test; unresolved questions; methods, missingness and limitations. Do not label this example a completed commissioned study.

## Buildable requirements

1. Render observed facts and field-specific exclusions from the current `Evidence` object, not copied numeric strings. Recompute on refresh and withhold a finding if its signal is withheld. The editorial interpretation must remain a separate labelled field, never interpolated into a measured claim.
2. Keep observation dates distinct from source-check and publication dates. A fresh source read does not mean the underlying field observations are new. Include the market scope, observation unit, identity-review count and snapshot/stale status where relevant.
3. Provide a citable aggregate brief and fixed evidence links. The owner requested removal of the print action; citation and evidence inspection are the explicit controls. Do not export source rows, private identifiers or contact details. The bounded archive at `/briefs/yaba-2026-10-20` uses a separately committed aggregate file and frozen allowlist. Retain that file unchanged when publishing later editions; changed evidence must not reuse its citation.
4. Lead the enquiry with the decision: buyer role, decision/question, intended geography/product category and desired deadline. Explain that desired coverage and timing are requests to scope, not existing dataset coverage or a delivery guarantee. Preserve the selected scenario and evidence version. Do not collect merchant private data in this form.
5. Show supported evidence topics before free-text entry. Unsupported questions should offer an explicit, optional investigation enquiry. Do not persist unanswered questions silently or subscribe someone automatically.
6. Show an illustrative deliverable before the email form. State which parts can be answered from existing evidence and which require new work. Keep quote-first approval and editorial completion controls.
7. Publish a short evidence change note distinguishing new observations, source repairs, inclusion-policy changes and reviewed matched comparisons. The 87→115 revision is a policy/layout change. It must not be a growth arrow or economic trend.

## Acceptance checks

- Every observed number in the new brief equals the active published signal, including after a revision or withheld signal. A test should change the evidence and verify that the brief changes, rather than merely assert copied markup.
- No cross-signal overlap, representativeness, causal or predicted outcome is inferred. Unknown/inapplicable answers do not become negative or positive observations.
- Stale/snapshot labels and all material caveats remain visible on screen and in print. Print contains no private contact or source identifiers.
- The enquiry makes no payment, delivery-time or new-geography promise. Topic notifications remain a separate explicit choice. Existing routing and request-flow tests remain intact.
- A distributor can identify one observation, one important unknown and one next field question in a short moderated session. Treat the result as usability evidence, not population-level demand proof.

## Parallel work that software cannot replace

Proposed discovery: 5–10 reachable distributor/procurement decision makers; ask about their latest real purchasing decision, what delayed it, current evidence sources, how useful this example would be, who approves research spending, and what they would need before agreeing a paid scope. Record a decision/question, not just a favorable reaction. No outreach is authorized by this document.

Before fieldwork: assign intake/scoping, field operations, participant-consent, analysis/editorial and delivery owners. Roles may be shared, but responsibility must be explicit. Reconcile identities privately and agree measures and visit windows before promising a panel. The current 115 observations are not automatically enrolled in a follow-up study.

Before live email: resolve hosting authorization, configure server-only credentials, review sender/privacy/processor terms and test actual requested delivery and removal. Local simulated outbox success is not production delivery proof.

## Proposed review gates

- After brief usability sessions: continue if intended users can explain what it supports and cannot support; revise the entry journey if they mistake it for a market-wide forecast.
- After first agreed paid brief: assess actual delivery effort, cost, usefulness and interest in another decision. If the repeat question is absent, investigate why before selling a recurring watch.
- Before panel publication: verify identity, return-visit consent, comparability, missingness/attrition and sample claims. Do not choose a participant count solely to cross the ten-pair publication floor.

These gates are proposed decisions for the team, not validated thresholds or revenue forecasts. Choose dated commitments only after the owner confirms people, customer access and field capacity.
