import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { FileEngagementStore, RedisEngagementStore } from './engagement-store';
import { createEngagementService, PublicServiceError, type EmailMessage } from './engagement';
import { getPublishedEvidence } from './get-evidence';

const localDirectory = join(process.cwd(), '.local-data');
let instance: ReturnType<typeof configure> | undefined;
function configure() {
  const live = process.env.ERI_ENGAGEMENT_MODE === 'live';
  const local = process.env.NODE_ENV === 'development' && !live;
  const origin = new URL(process.env.ERI_SITE_URL || (local ? 'http://127.0.0.1:3000' : 'https://ask.useeri.com')).origin;
  if (live && (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN || !process.env.RESEND_API_KEY || !process.env.ERI_EMAIL_FROM || !process.env.ERI_SITE_URL || !process.env.ERI_OPERATIONS_SECRET || process.env.ERI_OPERATIONS_SECRET.length < 32)) throw new PublicServiceError('Email requests are not activated yet. Please check back later.', 503);
  if (!live && !local) throw new PublicServiceError('Email requests are not activated yet. Please check back later.', 503);
  if (live && new URL(origin).protocol !== 'https:') throw new PublicServiceError('Service configuration is incomplete.', 503);
  const store = local ? new FileEngagementStore(join(localDirectory, 'engagement.json')) : new RedisEngagementStore(process.env.UPSTASH_REDIS_REST_URL!, process.env.UPSTASH_REDIS_REST_TOKEN!);
  const send = async (message: EmailMessage) => {
    if (local) {
      await store.set(`eri:v1:outbox:${message.id}`, { ...message, simulated: true, createdAt: new Date().toISOString() }, { ttl: 14 * 86400 });
      return { id: `local-${message.id}` };
    }
    const headers: Record<string, string> = {};
    if (message.unsubscribe) {
      const action = new URL(message.unsubscribe);
      action.pathname = '/api/engagement/unsubscribe';
      headers['List-Unsubscribe'] = `<${action}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': message.id },
      body: JSON.stringify({ from: process.env.ERI_EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text, headers }), signal: AbortSignal.timeout(15_000), cache: 'no-store',
    });
    if (!response.ok) throw new Error('Email provider unavailable');
    const body = await response.json() as { id?: string }; if (!body.id) throw new Error('Email acceptance not confirmed');
    return { id: body.id };
  };
  const service = createEngagementService({ store, mode: local ? 'local' : 'live', origin, send, evidence: async () => (await getPublishedEvidence()).evidence, publicationReady: async () => (await getPublishedEvidence()).connection.mode !== 'stale' });
  return { mode: local ? 'local' as const : 'live' as const, origin, store, service };
}
export function engagementRuntime() { instance ??= configure(); return instance; }
export function engagementStatus() {
  try { const runtime = engagementRuntime(); return { mode: runtime.mode, message: runtime.mode === 'local' ? 'Local testing: records and messages stay in the test outbox. No email is sent.' : 'Email confirmation is required. Field briefs are quoted before work begins.' }; }
  catch { return { mode: 'unavailable', message: 'Email requests and notifications are awaiting service activation.' }; }
}
export async function operationsSecret() {
  if (process.env.ERI_OPERATIONS_SECRET) return process.env.ERI_OPERATIONS_SECRET;
  if (process.env.NODE_ENV !== 'development') throw new PublicServiceError('Operations unavailable.', 503);
  await mkdir(localDirectory, { recursive: true });
  const path = join(localDirectory, 'operations-secret');
  try { return await readFile(path, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const value = randomBytes(32).toString('base64url');
    try { await writeFile(path, value, { flag: 'wx', mode: 0o600 }); return value; }
    catch (failure) { if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure; return readFile(path, 'utf8'); }
  }
}
export async function authorizeOperations(request: Request) {
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const expected = await operationsSecret();
  const a = Buffer.from(supplied); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new PublicServiceError('Not authorised.', 401);
}
