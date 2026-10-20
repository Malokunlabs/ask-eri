import { analyze } from './analyze.ts';
import { publishEvidence } from './publish-evidence.ts';
import type { SourceTable } from './source-schema.ts';
import type { Evidence, EvidenceResponse } from './evidence-types.ts';

export const REFRESH_SECONDS = 60;

// Per-process single-flight refresh. Only the aggregate result survives a read.
// Cold starts fall back to the committed validated snapshot, never invented data.
export function createEvidenceService(options: {
  snapshot: Evidence;
  configured: () => boolean;
  load: () => Promise<SourceTable>;
  now?: () => number;
  panelApprovalReference?: string;
}) {
  const now = options.now ?? Date.now;
  let lastAttempt = -Infinity;
  let pending: Promise<EvidenceResponse> | null = null;
  let current: EvidenceResponse = {
    evidence: options.snapshot,
    connection: { mode: 'snapshot', checkedAt: null, refreshSeconds: REFRESH_SECONDS, message: 'Validated snapshot. Automatic source updates are not connected.' },
  };
  return async function getEvidence(): Promise<EvidenceResponse> {
    if (!options.configured()) return current;
    if (pending) return pending;
    if (now() - lastAttempt < REFRESH_SECONDS * 1000) return current;
    lastAttempt = now();
    pending = (async () => {
      try {
        const table = await options.load();
        const evidence = publishEvidence(analyze(table, new Date(now()), options.panelApprovalReference));
        current = {
          evidence,
          connection: { mode: 'live', checkedAt: new Date(now()).toISOString(), refreshSeconds: REFRESH_SECONDS, message: 'Source connected. New observations pass analysis checks before publication; checked every minute while this page is open.' },
        };
      } catch {
        // Do not serialize API errors: they can contain source rows or credentials.
        current = {
          evidence: current.evidence,
          connection: { mode: 'stale', checkedAt: new Date(now()).toISOString(), refreshSeconds: REFRESH_SECONDS, message: 'The latest source could not be validated. Showing the last validated analysis; automatic retries continue.' },
        };
      } finally { pending = null; }
      return current;
    })();
    return pending;
  };
}
