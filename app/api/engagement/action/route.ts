import { engagementRuntime } from '../../../../lib/engagement-runtime';
import { boundedJson, responseJson, sameOrigin, serviceFailure } from '../../../../lib/request-safety';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const runtime = engagementRuntime(); sameOrigin(request, runtime.origin);
    const body = await boundedJson(request, 4096);
    return responseJson(await runtime.service.action(String(body.purpose), String(body.id), String(body.token)));
  } catch (error) { return serviceFailure(error); }
}
