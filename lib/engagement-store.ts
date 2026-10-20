import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface EngagementStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ttl?: number; nx?: boolean }): Promise<boolean>;
  remove(key: string): Promise<void>;
  release(key: string, owner: string): Promise<void>;
  limit(key: string, maximum: number, seconds: number): Promise<boolean>;
  scan(prefix: string, cursor?: string, count?: number): Promise<{ keys: string[]; cursor: string }>;
}
type Entries = Record<string, { value: unknown; expires: number }>;

// A single-process development store, never selected in production. Atomic
// replacement keeps local test records across server restarts.
export class FileEngagementStore implements EngagementStore {
  private pending: Promise<unknown> = Promise.resolve();
  private path: string; private clock: () => number;
  constructor(path: string, clock = Date.now) { this.path = path; this.clock = clock; }
  private transaction<T>(fn: (entries: Entries) => T): Promise<T> {
    const operation = this.pending.then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      let entries: Entries = {};
      try { entries = JSON.parse(await readFile(this.path, 'utf8')); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      for (const [key, entry] of Object.entries(entries)) if (entry.expires && entry.expires <= this.clock()) delete entries[key];
      const value = fn(entries);
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(entries), { mode: 0o600 });
      await rename(temporary, this.path);
      return value;
    });
    this.pending = operation.catch(() => {});
    return operation;
  }
  get<T>(key: string) { return this.transaction(entries => (entries[key]?.value as T) ?? null); }
  set(key: string, value: unknown, options: { ttl?: number; nx?: boolean } = {}) {
    return this.transaction(entries => {
      if (options.nx && entries[key]) return false;
      entries[key] = { value, expires: options.ttl ? this.clock() + options.ttl * 1000 : 0 }; return true;
    });
  }
  async remove(key: string) { await this.transaction(entries => { delete entries[key]; }); }
  async release(key: string, owner: string) { await this.transaction(entries => { if (entries[key]?.value === owner) delete entries[key]; }); }
  limit(key: string, maximum: number, seconds: number) {
    return this.transaction(entries => {
      const entry = entries[key] ?? { value: 0, expires: this.clock() + seconds * 1000 };
      entry.value = Number(entry.value) + 1; entries[key] = entry; return Number(entry.value) <= maximum;
    });
  }
  scan(prefix: string, cursor = '0', count = 100) {
    return this.transaction(entries => {
      const keys = Object.keys(entries).filter(key => key.startsWith(prefix)).sort();
      const start = Number(cursor); const page = keys.slice(start, start + count);
      return { keys: page, cursor: start + count >= keys.length ? '0' : String(start + count) };
    });
  }
}

// Uses the Redis REST command API. Inputs remain command arguments, never Lua
// source interpolation. The server token is never exposed to clients.
export class RedisEngagementStore implements EngagementStore {
  private url: string; private token: string; private request: typeof fetch;
  constructor(url: string, token: string, request: typeof fetch = fetch) {
    this.url = url; this.token = token; this.request = request;
    if (new URL(url).protocol !== 'https:') throw new Error('Redis REST requires HTTPS.');
  }
  private async command<T>(args: (string | number)[]): Promise<T> {
    const response = await this.request(this.url, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Storage unavailable');
    const body = await response.json() as { result: T; error?: string };
    if (body.error) throw new Error('Storage command failed');
    return body.result;
  }
  async get<T>(key: string) { const value = await this.command<string | null>(['GET', key]); return value === null ? null : JSON.parse(value) as T; }
  async set(key: string, value: unknown, options: { ttl?: number; nx?: boolean } = {}) {
    const args: (string | number)[] = ['SET', key, JSON.stringify(value)];
    if (options.ttl) args.push('EX', options.ttl); if (options.nx) args.push('NX');
    return await this.command<string | null>(args) === 'OK';
  }
  async remove(key: string) { await this.command(['DEL', key]); }
  async release(key: string, owner: string) {
    await this.command(['EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) else return 0 end", 1, key, JSON.stringify(owner)]);
  }
  async limit(key: string, maximum: number, seconds: number) {
    const value = await this.command<number>(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, seconds]);
    return value <= maximum;
  }
  async scan(prefix: string, cursor = '0', count = 100) {
    const [next, keys] = await this.command<[string, string[]]>(['SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', count]);
    return { keys, cursor: next };
  }
}
