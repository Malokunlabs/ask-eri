import 'server-only';
import { createEvidenceService } from './evidence-service';
import { loadGoogleSource, sourceConfigured } from './google-source';
import snapshot from '../data/evidence-snapshot.json';
import type { Evidence } from './evidence-types';

export const getPublishedEvidence = createEvidenceService({ snapshot: snapshot as Evidence, configured: sourceConfigured, load: loadGoogleSource, panelApprovalReference: process.env.ERI_PANEL_APPROVAL_REFERENCE });
