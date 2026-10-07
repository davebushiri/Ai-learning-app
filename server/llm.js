// Thin wrapper around the Claude API. The rest of the server only calls
// generateScenario() and gradeExplanation().

import Anthropic from '@anthropic-ai/sdk';
import { SCENARIO_SCHEMA, GRADE_SCHEMA } from '../shared/contract.js';
import { SCENARIO_SYSTEM, scenarioUserPrompt } from './prompts/scenario.js';
import { GRADE_SYSTEM, gradeUserPrompt } from './prompts/grade.js';

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// Grading happens live on stage, so it runs at low effort for latency.
const SCENARIO_EFFORT = process.env.SCENARIO_EFFORT || 'medium';
const GRADE_EFFORT = process.env.GRADE_EFFORT || 'low';

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

async function askForJson({ system, user, schema, effort }) {
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort, format: { type: 'json_schema', schema } },
    // If a safety classifier declines (e.g. a trade hazard reads as harmful),
    // the API retries on a fallback model instead of failing the demo.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default'
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Claude declined: ${response.stop_details?.category ?? 'unknown'}`);
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude response was cut off (max_tokens)');
  }
  const text = response.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Claude returned no text');
  return JSON.parse(text);
}

export function generateScenario(tradeId, trade) {
  return askForJson({
    system: SCENARIO_SYSTEM,
    user: scenarioUserPrompt(tradeId, trade),
    schema: SCENARIO_SCHEMA,
    effort: SCENARIO_EFFORT
  });
}

export function gradeExplanation({ scenario, stepId, errorStepId, explanation }) {
  return askForJson({
    system: GRADE_SYSTEM,
    user: gradeUserPrompt(scenario, stepId, errorStepId, explanation),
    schema: GRADE_SCHEMA,
    effort: GRADE_EFFORT
  });
}
