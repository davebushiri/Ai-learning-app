// All network calls from the browser live here.
import { mockGrade } from '/shared/mock-grader.js';

async function getJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const fetchHealth = () => getJson('/api/health');
export const fetchTrades = () => getJson('/api/trades');

export async function fetchScenario(trade, { cached = false } = {}) {
  const fixtureUrl = `/api/scenario?${new URLSearchParams({ trade, source: 'fixture' })}`;
  if (cached) return getJson(fixtureUrl);
  // Never leave "Start the job" hanging on a slow or broken live generation.
  try {
    return await getJson(`/api/scenario?${new URLSearchParams({ trade })}`, { signal: AbortSignal.timeout(50000) });
  } catch (err) {
    console.warn('live scenario failed, using cached one', err);
    return { ...(await getJson(fixtureUrl)), source: 'fixture-fallback' };
  }
}

// Never let a grading failure stall the demo: fall back to the keyword grader.
export async function gradeStop({ scenario, stepId, errorStepId, explanation }) {
  try {
    return await getJson('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, stepId, errorStepId, explanation }),
      signal: AbortSignal.timeout(12000)
    });
  } catch (err) {
    console.warn('grade failed, using local keyword grader', err);
    return { ...mockGrade(scenario, errorStepId, explanation), source: 'local-fallback' };
  }
}
