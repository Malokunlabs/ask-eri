import { readFile } from 'node:fs/promises';
// The key comes from the environment or ignored local file, never CLI arguments.
const origin = process.env.ERI_SITE_URL || 'http://127.0.0.1:3000';
const secret = process.env.ERI_OPERATIONS_SECRET || await readFile(new URL('../.local-data/operations-secret', import.meta.url), 'utf8');
const [command, file] = process.argv.slice(2);
let body: unknown;
if (command === 'work') body = { action: 'work' };
else if (command === 'approve-scope' || command === 'complete' || command === 'publish-update') {
  if (!file) throw new Error('Supply a private JSON file with the operation details.');
  body = { ...JSON.parse(await readFile(file, 'utf8')), action: command };
} else if (command !== 'list') throw new Error('Use list, work, complete <private.json> or publish-update <private.json>.');
const response = await fetch(`${origin}/api/operations`, { method: command === 'list' ? 'GET' : 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const result = await response.json();
if (!response.ok) throw new Error(result.error || 'Operation failed');
console.log(JSON.stringify(result, null, 2));
