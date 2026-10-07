// All network calls from the browser live here.
import { mockGrade } from '/shared/mock-grader.js';

async function getJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

export const fetchHealth = () => getJson('/api/health');
export const fetchTrades = () => getJson('/api/trades');

export function fetchScenario(trade, { cached = false } = {}) {
  const qs = new URLSearchParams({ trade });
  if (cached) qs.set('source', 'fixture');
  return getJson(`/api/scenario?${qs}`);
}

// Never let a grading failure stall the demo: fall back to the keyword grader.
export async function gradeStop({ scenario, stepId, errorStepId, explanation }) {
  try {
    return await getJson('/api/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, stepId, errorStepId, explanation })
    });
  } catch (err) {
    console.warn('grade failed, using local keyword grader', err);
    return { ...mockGrade(scenario, errorStepId, explanation), source: 'local-fallback' };
  }
}
