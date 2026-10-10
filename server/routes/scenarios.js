// GET /api/trades                      -> [{ id, label }]
// GET /api/scenario?trade=electrical   -> Scenario   (&source=fixture forces the cached one)

import { TRADES, listTrades } from '../prompts/trades.js';
import { sendJson } from '../http.js';
import { getScenario } from '../services/content.js';

export async function handle(req, res, url) {
  if (url.pathname === '/api/trades') {
    sendJson(res, 200, listTrades());
    return true;
  }
  if (url.pathname === '/api/scenario') {
    const trade = url.searchParams.get('trade') || 'electrical';
    if (!Object.hasOwn(TRADES, trade)) {
      sendJson(res, 400, { error: `unknown trade ${trade}` });
      return true;
    }
    const result = await getScenario(trade, url.searchParams.get('source'));
    // Read by the [api] log line in server/index.js.
    res.apiSource = result.source;
    sendJson(res, 200, { ...result.scenario, source: result.source });
    return true;
  }
  return false;
}
