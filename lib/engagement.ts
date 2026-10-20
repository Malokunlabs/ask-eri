import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { buildDecision, buildInvestigation, evidenceDigestContent, type Audience, type DecisionInputs, type DecisionBrief } from './decision-model.ts';
import type { Evidence } from './evidence-types.ts';
import type { EngagementStore } from './engagement-store.ts';
import { requestContext, type RequestContext } from './request-context.ts';

const PREFIX = 'eri:v1:';
const DAY = 86400;
export const notificationTopics = ['signals', 'longitudinal', 'site'] as const;
export type NotificationTopic = (typeof notificationTopics)[number];
export class PublicServiceError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
export type EmailMessage = { id: string; to: string; subject: string; text: string; unsubscribe?: string };
export type EngagementRecord = {
  id: string; kind: 'request' | 'subscription'; email: string; organisation: string;
  status: 'pending' | 'requested' | 'active' | 'scoping' | 'in-field' | 'ready' | 'emailed' | 'cancelled';
  createdAt: string; confirmedAt?: string; consentVersion: string; topics: NotificationTopic[];
  confirmHash: string; cancelHash: string; confirmationExpires: number;
  cancelToken: string; confirmationToken: string;
  requestContext?: RequestContext;
  scope?: { description: string; quote: string; approvalReference: string; approvedAt: string };
  brief?: DecisionBrief; customQuestion?: string; report?: string; emailAcceptedAt?: string;
};
type Job = EmailMessage & { recordId: string; purpose: 'confirm' | 'receipt' | 'report' | 'update'; state: 'queued' | 'sent' | 'failed' | 'skipped'; attempts: number; createdAt: number; nextAttempt: number; acceptedId?: string };
type Update = { id: string; topic: NotificationTopic; title: string; summary: string; createdAt: string; cursor: string; expanded: boolean; digest?: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const recordKey = (id: string) => `${PREFIX}record:${id}`;
const jobKey = (id: string) => `${PREFIX}job:${id}`;
function equal(a: string, b: string) { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); }
function text(value: unknown, maximum: number, minimum = 0) {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum || /[\u0000-\u0008]/.test(value)) throw new PublicServiceError('Check the form fields.');
  return value.trim();
}
function emailAddress(value: unknown) {
  const email = text(value, 254, 3).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\r\n]/.test(email)) throw new PublicServiceError('Enter a valid email address.');
  return email;
}

export function createEngagementService(options: {
  store: EngagementStore; mode: 'local' | 'live'; origin: string;
  send: (message: EmailMessage) => Promise<{ id: string }>;
  evidence: () => Promise<Evidence>; publicationReady?: () => Promise<boolean>; clock?: () => number;
}) {
  const { store, origin, mode } = options;
  const clock = options.clock ?? Date.now;
  const now = () => new Date(clock()).toISOString();
  const actionLink = (purpose: string, id: string, token: string) => `${origin}/email-action?${new URLSearchParams({ purpose, id, token })}`;
  const cancelLink = (record: EngagementRecord) => actionLink('unsubscribe', record.id, record.cancelToken);
  async function save(record: EngagementRecord, ttl = 180 * DAY) { await store.set(recordKey(record.id), record, { ttl }); }
  async function load(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new PublicServiceError('This link is invalid or expired.', 404);
    const record = await store.get<EngagementRecord>(recordKey(id));
    if (!record) throw new PublicServiceError('This link is invalid or expired.', 404);
    return record;
  }
  async function queue(record: EngagementRecord, purpose: Job['purpose'], message: Omit<EmailMessage, 'id' | 'to'>, key: string = purpose) {
    const id = hash(`${record.id}:${key}`);
    const job: Job = { ...message, id, to: record.email, recordId: record.id, purpose, state: 'queued', attempts: 0, createdAt: clock(), nextAttempt: clock() };
    await store.set(jobKey(id), job, { ttl: 14 * DAY, nx: true });
    return id;
  }
  async function sendJob(id: string) {
    const owner = randomUUID(); const lock = `${PREFIX}job-lock:${id}`;
    if (!await store.set(lock, owner, { nx: true, ttl: 120 })) return false;
    try {
      const job = await store.get<Job>(jobKey(id));
      if (!job || job.state !== 'queued' || job.nextAttempt > clock()) return false;
      const record = await store.get<EngagementRecord>(recordKey(job.recordId));
      const allowed = record && record.status !== 'cancelled' && (job.purpose === 'confirm' ? record.status === 'pending' : job.purpose === 'update' ? record.kind === 'subscription' && record.status === 'active' : record.kind === 'request' && record.status !== 'pending');
      if (!allowed) { job.state = 'skipped'; await store.set(jobKey(id), job, { ttl: 14 * DAY }); return false; }
      // Provider idempotency is bounded to 24h. After that, require an operator
      // to inspect the delivery status rather than risking a duplicate email.
      if (clock() - job.createdAt >= DAY * 1000) { job.state = 'failed'; await store.set(jobKey(id), job, { ttl: 14 * DAY }); return false; }
      try {
        const result = await options.send(job);
        job.state = 'sent'; job.acceptedId = result.id;
        await store.set(jobKey(id), job, { ttl: 14 * DAY });
        if (job.purpose === 'report' && record) { record.status = 'emailed'; record.emailAcceptedAt = now(); await save(record); }
        return true;
      } catch {
        job.attempts++;
        job.state = job.attempts >= 8 ? 'failed' : 'queued';
        job.nextAttempt = clock() + Math.min(3600, 60 * 2 ** job.attempts) * 1000;
        await store.set(jobKey(id), job, { ttl: 14 * DAY });
        return false;
      }
    } finally { await store.release(lock, owner); }
  }
  async function submit(input: Record<string, unknown>, clientKey: string) {
    if (input.website) return { mode, message: 'If valid, your request will be processed.' };
    if (input.consent !== true) throw new PublicServiceError('Please agree to the requested email contact.');
    const email = emailAddress(input.email);
    if (!await store.limit(`${PREFIX}limit:client:${hash(clientKey)}`, 20, 3600) || !await store.limit(`${PREFIX}limit:email:${hash(email)}`, 3, 3600)) throw new PublicServiceError('Please wait before requesting another email.', 429);
    const kind = input.kind === 'request' ? 'request' : input.kind === 'subscription' ? 'subscription' : null;
    if (!kind) throw new PublicServiceError('Choose a supported request.');
    const topics = kind === 'subscription' && Array.isArray(input.topics) ? [...new Set(input.topics)].filter((topic): topic is NotificationTopic => notificationTopics.includes(topic as NotificationTopic)) : [];
    if (kind === 'subscription' && (!topics.length || topics.length !== new Set(input.topics as unknown[]).size)) throw new PublicServiceError('Choose at least one supported notification topic.');
    let brief: DecisionBrief | undefined;
    if (kind === 'request') {
      if (input.requestMode !== undefined && !['scenario','investigation'].includes(String(input.requestMode))) throw new PublicServiceError('Choose a supported enquiry.');
      try {
        if (input.requestMode === 'investigation') brief = buildInvestigation(input.audience as Audience, String(input.question ?? ''), await options.evidence());
        else {
          if (!input.inputs || typeof input.inputs !== 'object' || Array.isArray(input.inputs)) throw new Error('Include valid scenario assumptions.');
          brief = buildDecision(input.audience as Audience, input.inputs as DecisionInputs, await options.evidence());
        }
      } catch { throw new PublicServiceError('Check the audience, decision question and scenario assumptions.'); }
    }
    let context: RequestContext | undefined;
    if (kind === 'request') { try { context=requestContext(input.requestContext); } catch { throw new PublicServiceError('Check your decision details and desired deadline.'); } }
    const confirmationToken = secret(); const cancelToken = secret();
    const record: EngagementRecord = { id: randomUUID(), kind, email, organisation: text(input.organisation ?? '', 160, kind === 'request' ? 2 : 0), status: 'pending', consentVersion: '2026-10-19', topics, createdAt: now(), confirmHash: hash(confirmationToken), cancelHash: hash(cancelToken), confirmationExpires: clock() + 2 * DAY * 1000, confirmationToken, cancelToken, brief, requestContext: context, customQuestion: kind === 'request' ? text(input.question ?? '', 1500) : undefined };
    await save(record, 2 * DAY);
    const confirmationUrl = actionLink('confirm', record.id, confirmationToken);
    const id = await queue(record, 'confirm', { subject: kind === 'request' ? 'Confirm your ERI field-brief request' : 'Confirm your ERI signal notifications', text: `Confirm this ${kind === 'request' ? 'field-brief enquiry' : 'notification signup'}:\n\n${confirmationUrl}\n\nThis link expires in 48 hours. If you did not request it, ignore this email. No payment has been taken.\n\nCancel and remove this contact record: ${cancelLink(record)}`, unsubscribe: cancelLink(record) });
    const sent = await sendJob(id);
    return { mode, message: mode === 'local' ? 'Saved in the local test outbox. No email was sent.' : sent ? 'Check your inbox to confirm your email. Your request is not active until confirmed.' : 'Saved. The confirmation email is queued for retry; it has not been sent yet.', ...(mode === 'local' ? { confirmationUrl } : {}) };
  }
  async function action(purpose: string, id: string, token: string) {
    const owner = randomUUID(); const lock = `${PREFIX}record-lock:${id}`;
    if (!await store.set(lock, owner, { nx: true, ttl: 120 })) throw new PublicServiceError('Please retry shortly.', 409);
    try {
      const record = await load(id);
      if (purpose === 'unsubscribe') {
        if (!equal(hash(token), record.cancelHash)) throw new PublicServiceError('This link is invalid or expired.', 404);
        await store.remove(recordKey(id));
        if (record.kind === 'subscription') await store.release(`${PREFIX}subscriber:${hash(record.email)}`, id);
        await purgeJobs(id);
        await store.remove(`${PREFIX}subscriber-baseline:${id}`);
        return { message: 'Your contact record was removed. Queued emails for it will not be sent.' };
      }
      if (purpose !== 'confirm' || !equal(hash(token), record.confirmHash) || record.confirmationExpires < clock()) throw new PublicServiceError('This link is invalid or expired.', 404);
      if (record.status !== 'pending') return { message: 'This email is already confirmed.' };
      record.status = record.kind === 'subscription' ? 'active' : 'requested'; record.confirmedAt = now();
      // A subscriber starts at the current evidence revision, not an old update.
      if (record.kind === 'subscription') {
        const indexKey = `${PREFIX}subscriber:${hash(record.email)}`;
        const emailOwner = randomUUID(); const emailLock = `${indexKey}:lock`;
        if (!await store.set(emailLock, emailOwner, { nx: true, ttl: 120 })) throw new PublicServiceError('Please retry shortly.', 409);
        try {
          const previous = await store.get<string>(indexKey);
          if (previous && previous !== id) { await store.remove(recordKey(previous)); await purgeJobs(previous); await store.remove(`${PREFIX}subscriber-baseline:${previous}`); }
          await store.set(indexKey, id, { ttl: 365 * DAY });
          await store.set(`${PREFIX}subscriber-baseline:${id}`, hash(evidenceDigestContent(await options.evidence())), { ttl: 365 * DAY });
          await save(record, 365 * DAY);
        } finally { await store.release(emailLock, emailOwner); }
      }
      if (record.kind === 'request') await save(record, 180 * DAY);
      if (record.kind === 'request') {
        const job = await queue(record, 'receipt', { subject: 'ERI field-brief enquiry received', text: `Your enquiry is confirmed. Reference: ${record.id}\n\nERI will review the question and propose scope, price and timing before any paid fieldwork. No payment has been taken and no study has started.\n\n${record.customQuestion || record.brief?.question}\n\nRequested role: ${record.requestContext?.buyerRole || 'Not supplied'}. Requested geography: ${record.requestContext?.geography || 'To agree'}. Category: ${record.requestContext?.productCategory || 'To agree'}. Desired deadline: ${record.requestContext?.desiredDeadline || 'To agree'} (not a delivery promise). Requested source edition: ${record.requestContext?.sourceEdition || 'Current view'}.\n\nCancel and remove your contact record: ${cancelLink(record)}`, unsubscribe: cancelLink(record) });
        await sendJob(job);
      }
      return { message: record.kind === 'subscription' ? 'Notifications confirmed for your selected topics. You can unsubscribe from any update. Confirmation lasts up to 12 months.' : 'Your field-brief enquiry is confirmed. Scope, price and timing must be agreed before any fieldwork.' };
    } finally { await store.release(lock, owner); }
  }
  async function purgeJobs(recordId: string) {
    const keys: string[] = []; let cursor = '0';
    do { const page = await store.scan(`${PREFIX}job:`, cursor, 100); cursor = page.cursor; keys.push(...page.keys); } while (cursor !== '0');
    for (const key of keys) {
      const job = await store.get<Job>(key);
      if (job?.recordId === recordId) { await store.remove(key); await store.remove(`${PREFIX}outbox:${job.id}`); }
    }
  }
  async function approveScope(id: string, input: Record<string, unknown>) {
    const owner = randomUUID(); const lock = `${PREFIX}record-lock:${id}`;
    if (!await store.set(lock, owner, { nx: true, ttl: 120 })) throw new PublicServiceError('Request is busy.', 409);
    try {
      const record = await load(id);
      if (record.kind !== 'request' || record.status !== 'requested' || !record.confirmedAt) throw new PublicServiceError('A confirmed, unstarted enquiry is required.', 409);
      if (input.customerApproved !== true) throw new PublicServiceError('Record the customer’s explicit approval of scope, price and timing first.', 409);
      record.scope = { description: text(input.description, 3000, 20), quote: text(input.quote, 500, 5), approvalReference: text(input.approvalReference, 500, 5), approvedAt: now() };
      record.status = 'in-field'; await save(record);
      return { message: 'Agreed scope recorded. Complete only after fieldwork and editorial review.' };
    } finally { await store.release(lock, owner); }
  }
  async function complete(id: string, report: string) {
    const owner = randomUUID(); const lock = `${PREFIX}record-lock:${id}`;
    if (!await store.set(lock, owner, { nx: true, ttl: 120 })) throw new PublicServiceError('Request is busy.', 409);
    try {
      const record = await load(id);
      if (record.kind !== 'request' || !record.confirmedAt || record.status === 'pending') throw new PublicServiceError('The requester must confirm their email first.', 409);
      if (record.status === 'emailed') return { message: 'A completion email has already been accepted. Inspect it before issuing any correction.' };
      if (!record.scope || !['in-field', 'ready'].includes(record.status)) throw new PublicServiceError('Record the approved quote and scope before completing a brief.', 409);
      const content = text(report, 30_000, 40);
      if (record.report && record.report !== content) throw new PublicServiceError('A different report is already queued. Inspect delivery before issuing a correction.', 409);
      record.report = content; record.status = 'ready'; await save(record);
      const idJob = await queue(record, 'report', { subject: 'Your ERI field brief is ready', text: `${content}\n\n---\nRequest reference: ${record.id}\nEvidence context captured with the enquiry: ${record.brief?.observationPeriod}; ${record.brief?.cohortSize} eligible observations.\nScenario assumptions are not measured outcomes. The report must describe its actual sources and any completed fieldwork.\n\nRemove your contact record: ${cancelLink(record)}`, unsubscribe: cancelLink(record) });
      const accepted = await sendJob(idJob);
      return { mode, message: accepted ? mode === 'local' ? 'Completion message saved in the local outbox; no email sent.' : 'Completion email accepted by the provider. Inbox delivery is not yet confirmed.' : 'Completion saved; its email is queued for retry.' };
    } finally { await store.release(lock, owner); }
  }
  async function publishUpdate(topic: NotificationTopic, title: string, summary: string, id: string = randomUUID(), digest?: string) {
    if (topic === 'longitudinal' && !(await options.evidence()).longitudinal?.series.length) throw new PublicServiceError('No reviewed matched series is published.', 409);
    const update: Update = { id, topic, title: text(title, 160, 3), summary: text(summary, 3000, 10), createdAt: now(), cursor: '0', expanded: false, digest };
    await store.set(`${PREFIX}update:${id}`, update, { nx: true, ttl: 30 * DAY });
  }
  async function work() {
    const owner = randomUUID(); const lock = `${PREFIX}worker-lock`;
    if (!await store.set(lock, owner, { nx: true, ttl: 120 })) return { busy: true };
    try {
      const evidence = await options.evidence(); const digest = hash(evidenceDigestContent(evidence));
      const canPublish = options.publicationReady ? await options.publicationReady() : true;
      if (canPublish) {
      const previous = await store.get<string>(`${PREFIX}evidence-digest`);
      if (previous && previous !== digest) await publishUpdate('signals', 'ERI published evidence updated', `The analysed cohort or supported findings changed. Current observation period: ${evidence.period.label}. ${evidence.quality.includedRows} eligible initial observations; ${evidence.quality.identityReviewRows} included observations awaiting identity review; possible repeat submissions remain unresolved. Revisions can reflect QA changes, not economic change. Read the current evidence and limitations at ${origin}/#analysis`, hash(`${previous}:${digest}`), digest);
      await store.set(`${PREFIX}evidence-digest`, digest);
      // Longitudinal notifications are a distinct opt-in and require real matched data.
      const panelDigest = evidence.longitudinal?.series.length ? hash(JSON.stringify(evidence.longitudinal)) : null;
      const previousPanel = await store.get<string>(`${PREFIX}panel-digest`);
      if (panelDigest && previousPanel !== panelDigest) await publishUpdate('longitudinal', 'Matched field observations published', `Reviewed matched observations are now available. Read the cohort, paired denominators, periods and limitations at ${origin}/#longitudinal`, panelDigest);
      if (panelDigest) await store.set(`${PREFIX}panel-digest`, panelDigest);
      }
      let updateCursor = '0'; let queued = 0;
      do {
        const updates = await store.scan(`${PREFIX}update:`, updateCursor, 50); updateCursor = updates.cursor;
        for (const key of updates.keys) {
          const update = await store.get<Update>(key); if (!update || update.expanded) continue;
          const recipients = await store.scan(`${PREFIX}record:`, update.cursor, 100);
          for (const recipient of recipients.keys) {
            const record = await store.get<EngagementRecord>(recipient);
            if (!record || record.kind !== 'subscription' || record.status !== 'active' || !record.topics.includes(update.topic) || !record.confirmedAt || record.confirmedAt > update.createdAt) continue;
            const baseline = await store.get<string>(`${PREFIX}subscriber-baseline:${record.id}`);
            if (update.digest && baseline === update.digest) continue;
            await queue(record, 'update', { subject: update.title.replace(/[\r\n]/g, ' '), text: `${update.summary}\n\nView Ask ERI: ${origin}\n\nUnsubscribe and remove your contact record: ${cancelLink(record)}`, unsubscribe: cancelLink(record) }, `update:${update.id}`); queued++;
          }
          update.cursor = recipients.cursor; update.expanded = recipients.cursor === '0';
          await store.set(key, update, { ttl: 30 * DAY });
        }
      } while (updateCursor !== '0');
      // Scan each job page rather than repeatedly reading only the first keys.
      const jobCursor = await store.get<string>(`${PREFIX}job-cursor`) ?? '0';
      const jobs = await store.scan(`${PREFIX}job:`, jobCursor, 50);
      let accepted = 0;
      for (const key of jobs.keys) if (await sendJob(key.slice(`${PREFIX}job:`.length))) accepted++;
      await store.set(`${PREFIX}job-cursor`, jobs.cursor);
      return { mode, queued, accepted, jobsCursor: jobs.cursor };
    } finally { await store.release(lock, owner); }
  }
  async function operations(cursor = '0') {
    const page = await store.scan(`${PREFIX}record:`, cursor, 100);
    const records = await Promise.all(page.keys.map(key => store.get<EngagementRecord>(key)));
    return { cursor: page.cursor, records: records.filter(Boolean).map(record => {
      const { confirmHash: _a, cancelHash: _b, cancelToken: _c, confirmationToken: _d, ...safe } = record!; return safe;
    }) };
  }
  return { submit, action, approveScope, complete, work, publishUpdate, operations };
}
