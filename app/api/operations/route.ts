import { authorizeOperations, engagementRuntime } from '../../../lib/engagement-runtime';
import { boundedJson, responseJson, serviceFailure } from '../../../lib/request-safety';
import { runOperation } from '../../../lib/operations';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: Request) {
  try { await authorizeOperations(request); return responseJson(await engagementRuntime().service.operations(new URL(request.url).searchParams.get('cursor') ?? '0')); }
  catch (error) { return serviceFailure(error); }
}
export async function POST(request: Request) {
  try {
    await authorizeOperations(request);
    const body = await boundedJson(request, 40_000); const service = engagementRuntime().service;
    return responseJson(await runOperation(service,body));
  } catch (error) { return serviceFailure(error); }
}
