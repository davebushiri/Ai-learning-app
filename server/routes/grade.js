// POST /api/grade  GradeRequest -> GradeResponse

import { sendJson, readBody } from '../http.js';
import { grade } from '../services/assessment.js';

const isObject = v => v !== null && typeof v === 'object';

export async function handle(req, res, url) {
  if (url.pathname !== '/api/grade' || req.method !== 'POST') return false;
  const body = await readBody(req);
  const steps = body?.scenario?.steps;
  if (!Array.isArray(steps) || !steps.every(isObject)) {
    sendJson(res, 400, { error: 'scenario with steps required' });
    return true;
  }
  const result = await grade(body);
  // Read by the [api] log line in server/index.js.
  res.apiSource = result.source;
  sendJson(res, 200, result);
  return true;
}
