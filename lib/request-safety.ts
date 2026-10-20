import { PublicServiceError } from './engagement.ts';

export function responseJson(value: unknown, status = 200) { return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } }); }
export function serviceFailure(error: unknown) { return responseJson({ error: error instanceof PublicServiceError ? error.message : 'The service could not finish this request. Please retry later.' }, error instanceof PublicServiceError ? error.status : 503); }
export function sameOrigin(request: Request, expected: string) {
  if (request.headers.get('origin') !== expected) throw new PublicServiceError('This request must come from the site form.', 403);
}
export async function boundedJson(request: Request, maximum = 16_384): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new PublicServiceError('JSON is required.', 415);
  if (Number(request.headers.get('content-length')) > maximum) throw new PublicServiceError('Request is too large.', 413);
  const reader = request.body?.getReader(); if (!reader) throw new PublicServiceError('Request body is required.');
  let length = 0; const chunks: Uint8Array[] = [];
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > maximum) { await reader.cancel(); throw new PublicServiceError('Request is too large.', 413); } chunks.push(value); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new PublicServiceError('Invalid request body.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PublicServiceError('Invalid request body.');
  return body as Record<string, unknown>;
}
