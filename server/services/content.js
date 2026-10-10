// Scenario content: live generation with a fixture fallback.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TRADES } from '../prompts/trades.js';
import { validateScenario } from '../../shared/contract.js';
import { ROOT } from '../http.js';
import { MOCK, ai as llm } from './ai-client.js';
import { noteLive } from './live-status.js';

async function loadFixture(tradeId) {
  const file = path.join(ROOT, 'fixtures', 'scenarios', TRADES[tradeId].fixture);
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function getScenario(tradeId, source) {
  if (MOCK || source === 'fixture') return { scenario: await loadFixture(tradeId), source: 'fixture' };
  try {
    const scenario = await llm.generateScenario(tradeId, TRADES[tradeId]);
    if (scenario && typeof scenario === 'object') {
      // We asked for this trade; don't trust the model to echo it back.
      scenario.trade = tradeId;
      scenario.id ||= `live-${tradeId}-${Date.now()}`;
    }
    const problems = validateScenario(scenario);
    if (problems.length) throw new Error(`invalid scenario: ${problems.join('; ')}`);
    noteLive('scenario');
    return { scenario, source: 'live' };
  } catch (err) {
    noteLive('scenario', err);
    console.warn(`[scenario] live generation failed, using fixture: ${err.message}`);
    return { scenario: await loadFixture(tradeId), source: 'fixture-fallback' };
  }
}
