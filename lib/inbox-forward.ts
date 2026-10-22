import 'server-only';

// Forwards enquiries to the team inbox (info@useeri.com) through Web3Forms —
// the same provider/access key used by the main Eri site's contact form.
// The access key is bound to the destination inbox in the Web3Forms dashboard.
const ENDPOINT = 'https://api.web3forms.com/submit';

function field(value: unknown, max = 2000) {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, max);
}

export async function forwardToInbox(input: Record<string, unknown>) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY || process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
  if (!accessKey || input.website) return false; // not configured, or honeypot tripped
  const kind = input.kind === 'subscription' ? 'Notification signup' : 'Field-brief enquiry';
  const email = field(input.email, 254);
  const payload = {
    access_key: accessKey,
    subject: `Ask Eri: ${kind}${input.organisation ? ` — ${field(input.organisation, 160)}` : ''}`,
    from_name: 'Ask Eri',
    replyto: email,
    email,
    kind,
    organisation: field(input.organisation, 160),
    audience: field(input.audience, 100),
    request_mode: field(input.requestMode, 50),
    question: field(input.question, 1500),
    topics: Array.isArray(input.topics) ? input.topics.map(String).join(', ') : '',
    request_context: field(input.requestContext),
    scenario_inputs: field(input.inputs),
  };
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000), cache: 'no-store',
    });
    const body = await response.json().catch(() => ({})) as { success?: boolean; message?: string };
    if (!response.ok || !body.success) { console.error('Inbox forward failed:', body.message ?? response.status); return false; }
    return true;
  } catch (error) {
    console.error('Inbox forward error:', error);
    return false;
  }
}
