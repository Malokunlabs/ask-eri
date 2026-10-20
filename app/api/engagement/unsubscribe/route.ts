import { engagementRuntime } from '../../../../lib/engagement-runtime';
import { responseJson, serviceFailure } from '../../../../lib/request-safety';
export const runtime = 'nodejs';
// Token-authenticated POST for email clients' one-click unsubscribe. GET never mutates.
export async function POST(request: Request) {
  try { const url = new URL(request.url); return responseJson(await engagementRuntime().service.action('unsubscribe', url.searchParams.get('id') ?? '', url.searchParams.get('token') ?? '')); }
  catch (error) { return serviceFailure(error); }
}
