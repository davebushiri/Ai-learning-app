// Scenario content: live generation with a fixture fallback, read from the pack registry.

import { getScenarioEntry, listScenarios } from '../packs.js';
import { validateScenario } from '../../shared/contract.js';
import { MOCK, ai as llm } from './ai-client.js';
import { noteLive } from './live-status.js';

// The legacy routes serve one pack until the attempt API replaces them (removed by F1a-T18).
export const LEGACY_SUBJECT = 'demo-trades';

export const legacyScenarios = () => listScenarios(LEGACY_SUBJECT) ?? [];
export const legacyEntry = id => getScenarioEntry(LEGACY_SUBJECT, id);

// Registry cards are frozen and shared; every response gets its own copy.
const fixtureCard = entry => structuredClone(entry.card);

export async function getScenario(tradeId, source) {
  const entry = legacyEntry(tradeId);
  if (MOCK || source === 'fixture') return { scenario: fixtureCard(entry), source: 'fixture' };
  try {
    const scenario = await llm.generateScenario(tradeId, entry);
    if (scenario && typeof scenario === 'object') {
      // We asked for this scenario; don't trust the model to echo it back.
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
    return { scenario: fixtureCard(entry), source: 'fixture-fallback' };
  }
}
