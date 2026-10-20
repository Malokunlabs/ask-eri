import { timingSafeEqual } from 'node:crypto';
import { engagementRuntime } from '../../../../lib/engagement-runtime';
import { responseJson, serviceFailure } from '../../../../lib/request-safety';
import { PublicServiceError } from '../../../../lib/engagement';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
    if (!expected || expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) throw new PublicServiceError('Not authorised.', 401);
    return responseJson(await engagementRuntime().service.work());
  } catch (error) { return serviceFailure(error); }
}
