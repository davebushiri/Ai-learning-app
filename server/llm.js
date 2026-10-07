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
// Hard wall-clock limits per call, including SDK retries and retry-after waits.
// When one passes, the call throws and index.js falls back (fixture / keyword grader).
const SCENARIO_DEADLINE_MS = Number(process.env.SCENARIO_DEADLINE_MS) || 40000;
const GRADE_DEADLINE_MS = Number(process.env.GRADE_DEADLINE_MS) || 8000;

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

// With server-side fallback, a `fallback` block marks where a declining model's
// output stops and the next model's starts. Only the text after the last one counts.
export function responseText(content = []) {
  const start = content.findLastIndex(b => b.type === 'fallback') + 1;
  return content.slice(start).filter(b => b.type === 'text').map(b => b.text).join('');
}

async function askForJson({ kind, system, user, schema, effort, deadlineMs }) {
  const t0 = Date.now();
  let response;
  try {
    response = await getClient().beta.messages.create(
      {
        model: MODEL,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort, format: { type: 'json_schema', schema } },
        // If a safety classifier declines (e.g. a trade hazard reads as harmful),
        // the API retries on a fallback model instead of failing the demo.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default'
      },
      // A signal (not `timeout`) also caps the SDK's retry-after sleeps.
      { signal: AbortSignal.timeout(deadlineMs), maxRetries: 1 }
    );
  } catch (err) {
    const ms = Date.now() - t0;
    console.warn(`[claude] ${kind} failed after ${ms} ms status=${err.status ?? '-'} request=${err.requestID ?? '-'}: ${err.message}`);
    if (err instanceof Anthropic.APIUserAbortError) throw new Error(`Claude ${kind} timed out after ${deadlineMs} ms`);
    throw err;
  }

  const { model, stop_reason, usage, id } = response;
  console.log(`[claude] ${kind} ${Date.now() - t0} ms ${model} ${stop_reason} ${usage?.input_tokens}/${usage?.output_tokens} tokens ${id}`);
  if (stop_reason === 'refusal') {
    throw new Error(`Claude declined: ${response.stop_details?.category ?? 'unknown'}`);
  }
  if (stop_reason === 'max_tokens') {
    throw new Error('Claude response was cut off (max_tokens)');
  }
  const text = responseText(response.content);
  if (!text) throw new Error('Claude returned no text');
  return JSON.parse(text);
}

export function generateScenario(tradeId, trade) {
  return askForJson({
    kind: 'scenario',
    system: SCENARIO_SYSTEM,
    user: scenarioUserPrompt(tradeId, trade),
    schema: SCENARIO_SCHEMA,
    effort: SCENARIO_EFFORT,
    deadlineMs: SCENARIO_DEADLINE_MS
  });
}

export function gradeExplanation({ scenario, stepId, errorStepId, explanation }) {
  return askForJson({
    kind: 'grade',
    system: GRADE_SYSTEM,
    user: gradeUserPrompt(scenario, stepId, errorStepId, explanation),
    schema: GRADE_SCHEMA,
    effort: GRADE_EFFORT,
    deadlineMs: GRADE_DEADLINE_MS
  });
}
