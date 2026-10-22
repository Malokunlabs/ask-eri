import { engagementRuntime, engagementStatus, operationsSecret } from '../../../lib/engagement-runtime';
import { boundedJson, responseJson, sameOrigin, serviceFailure } from '../../../lib/request-safety';
import { forwardToInbox } from '../../../lib/inbox-forward';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { const status = engagementStatus(); if (status.mode === 'local') await operationsSecret(); return responseJson(status); }
export async function POST(request: Request) {
  try {
    const runtime = engagementRuntime(); sameOrigin(request, runtime.origin);
    const input = await boundedJson(request);
    const client = request.headers.get(process.env.VERCEL ? 'x-vercel-forwarded-for' : 'x-forwarded-for')?.split(',')[0].trim().slice(0, 200) || 'unknown-client';
    const result = await runtime.service.submit(input, client);
    await forwardToInbox(input); // copy to info@useeri.com via Web3Forms; never blocks the user
    return responseJson(result, 202);
  } catch (error) { return serviceFailure(error); }
}
