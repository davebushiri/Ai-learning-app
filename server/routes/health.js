// GET /api/health -> { mode, lastLiveOkAt, lastLiveError }

import { sendJson } from '../http.js';
import { MOCK } from '../services/ai-client.js';
import { liveStatus } from '../services/live-status.js';

export async function handle(req, res, url) {
  if (url.pathname !== '/api/health') return false;
  sendJson(res, 200, { mode: MOCK ? 'mock' : 'live', ...liveStatus });
  return true;
}
