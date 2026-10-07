// Keyword grader used when there is no API key (MOCK mode) or the live grader
// fails mid-demo. It is deliberately simple; the real grading lives in
// server/prompts/grade.js. The browser imports this too, so plain JS only.
//
// - Keywords match at the start of a word, with light stemming: "tested" hits
//   "test", but "online" doesn't hit "line" and "understand" doesn't hit "stand".
// - Keywords for the same idea ("test", "tester", "check") count once.
// - A small synonym list covers slang and speech-to-text ("juice", "nitro").
// - An answer that is nothing but keywords is capped at partial.
// - Any real attempt at the right moment gets partial, never "that's not it".

const SYNONYMS = {
  test: ['check', 'verify', 'make sure', 'volt stick', 'tick tester', 'probe', 'measure', 'meter'],
  live: ['alive', 'hot', 'power', 'energized', 'electric', 'juice', 'voltage', 'still on', 'dead', 'off', 'de-energized', 'deenergized', 'no power'],
  dead: ['live', 'off', 'de-energized', 'deenergized', 'no power'],
  circuit: ['different breaker', 'another breaker', 'other breaker', 'separate breaker', 'wrong breaker'],
  gfci: ['ground fault', 'gfi', 'gfic', 'g f c i', 'g f i'],
  backstab: ['stab', 'push in', 'push-in', 'quick connect'],
  nitrogen: ['nitro', 'n2', 'dry nitrogen'],
  purge: ['purging', 'flow'],
  extinguisher: ['fire bottle', 'fire extinguisher'],
  'jack stand': ['jackstand', 'stands', 'axle stand'],
  pump: ['pump up', 'seat the pads', 'bring the pads out', 'pads back out', 'pads out'],
  pedal: ['brakes']
};

const norm = t => String(t ?? '').toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const stem = k => (k.length > 4 ? k.replace(/(ing|ed|es|e|s)$/, '') : k);
// Short forms ("off", "arc", "gfi") must be the whole word, give or take a suffix.
const formRe = f => {
  const s = esc(stem(f));
  return new RegExp(`(^|[^a-z])${s}${f.length <= 3 ? '(s|es|ed|ing)?(?![a-z])' : '[a-z]*'}`, 'g');
};

export function mockGrade(scenario, errorStepId, explanation) {
  const step = scenario.steps.find(s => s.id === errorStepId);
  if (!step?.error) {
    return {
      verdict: 'false_alarm',
      reasoningScore: 0,
      feedback: 'That step was actually fine. Stopping the job costs time, so save the STOP for real hazards.'
    };
  }
  const { why } = step.error;
  const text = norm(explanation);
  if (text.split(' ').filter(Boolean).length < 2) {
    return { verdict: 'wrong', reasoningScore: 0, feedback: `You stopped at the right moment, but say what is wrong and why. ${why}` };
  }

  // Group keywords into concepts: a keyword joins a concept when it shares a
  // synonym with it or one keyword contains the other ("test" / "tester").
  const keywords = (step.error.keywords ?? []).filter(k => typeof k === 'string' && k.trim()).map(norm);
  const concepts = [];
  for (const k of keywords) {
    const forms = [k, ...(SYNONYMS[k] ?? [])];
    const same = concepts.find(c => c.keys.some(x => x.includes(k) || k.includes(x)) || c.forms.some(f => forms.includes(f)));
    if (same) { same.keys.push(k); same.forms.push(...forms); } else concepts.push({ keys: [k], forms });
  }

  let rest = text; // what's left once every matched keyword is taken out
  let hits = 0;
  for (const c of concepts) {
    const matched = c.forms.filter(f => formRe(f).test(text));
    if (matched.length) hits++;
    for (const f of matched) rest = rest.replace(formRe(f), '$1');
  }
  const stuffed = rest.split(/[^a-z]+/).filter(Boolean).length <= 2;

  if (hits >= 2 && !stuffed) return { verdict: 'correct', reasoningScore: 0.8, feedback: `Good catch. ${why}` };
  if (hits >= 1) return { verdict: 'partial', reasoningScore: 0.4, feedback: `You're onto it. ${why}` };
  return { verdict: 'partial', reasoningScore: 0.2, feedback: `Right moment to stop. Here's the problem: ${why}` };
}
