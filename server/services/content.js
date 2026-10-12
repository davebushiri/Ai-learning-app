// Scenario content: live generation through the gateway with a fixture fallback,
// read from the pack registry.

import { getScenarioEntry, listScenarios } from '../packs.js';
import { validateScenario } from '../../shared/contract.js';
import * as scenarioPrompt from '../prompts/scenario.js';
import { SCENARIO_DEADLINE_MS, SCENARIO_EFFORT } from '../ai/models.js';
import { MOCK, gateway } from './ai-client.js';
import { noteLive } from './live-status.js';

// The legacy routes serve one pack until the attempt API replaces them (removed by F1a-T18).
export const LEGACY_SUBJECT = 'demo-trades';

export const legacyScenarios = () => listScenarios(LEGACY_SUBJECT) ?? [];
export const legacyEntry = id => getScenarioEntry(LEGACY_SUBJECT, id);

// Registry cards are frozen and shared; every response gets its own copy.
const fixtureCard = entry => structuredClone(entry.card);

// The gateway's source -> the legacy route's source (FR-029).
const SOURCE = { live: 'live', mock: 'fixture', fallback: 'fixture-fallback' };

export async function getScenario(tradeId, source) {
  const entry = legacyEntry(tradeId);
  // ?source=fixture asks for the card itself; it is not a model call, so it logs nothing.
  if (source === 'fixture') return { scenario: fixtureCard(entry), source: 'fixture' };
  const result = await gateway.run({
    prompt: scenarioPrompt,
    input: { key: tradeId, entry },
    live: !MOCK,
    effort: SCENARIO_EFFORT,
    deadlineMs: SCENARIO_DEADLINE_MS,
    normalize: scenario => {
      if (scenario && typeof scenario === 'object') {
        // We asked for this scenario; don't trust the model to echo it back.
        scenario.trade = tradeId;
        scenario.id ||= `live-${tradeId}-${Date.now()}`;
      }
      return scenario;
    },
    // Same reason text as before the gateway, so warn lines and /api/health read the same.
    accept: scenario => {
      const problems = validateScenario(scenario);
      return problems.length ? [`invalid scenario: ${problems.join('; ')}`] : [];
    },
    // Must not throw: the gateway has already written the llm_call row by now.
    fallback: () => fixtureCard(entry)
  });
  if (result.source === 'live') noteLive('scenario');
  else if (result.source === 'fallback') {
    noteLive('scenario', { message: result.meta.error });
    console.warn(`[scenario] live generation failed, using fixture: ${result.meta.error}`);
  }
  return { scenario: result.data, source: SOURCE[result.source] };
}
