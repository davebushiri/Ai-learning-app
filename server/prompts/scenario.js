// Scenario-generation prompt — owned by the Brain.
// Output shape is enforced by SCENARIO_SCHEMA in shared/contract.js.

import { SCENARIO_SCHEMA } from '../../shared/contract.js';

// Bump on any change that alters the fingerprint (system, template or schema); ADR 0005.
export const VERSION = 1;

export const SCENARIO_SYSTEM = `You write training scenarios for "Stop the Apprentice", a game where a learner supervises a rookie apprentice who narrates a job out loud and occasionally makes mistakes. The learner's job is to hit STOP at the moment of a mistake and explain what's wrong.

Write the apprentice's narration as a sequence of steps. Rules:

Narration
- 8 to 11 steps. Each "line" is one or two short spoken sentences, first person, casual, the way a real apprentice talks while working. It will be read aloud by text-to-speech, so no symbols, abbreviations that read badly, or stage directions.
- The steps must follow the real order of the job from start to finish.
- Correct steps must be genuinely correct practice. Do not put subtle mistakes in steps you mark as error: null.

Mistakes
- Include exactly 3 mistakes: one "critical" (could seriously injure or kill someone), one "major" (code violation, property damage, or a comeback), and one "minor" (poor workmanship or a bad habit).
- Steps are numbered 1 to N in order. No mistake in steps 1 or 2 or in the last step, and at least one correct step between any two mistakes, so a learner who reacts one line late still catches the right one. Vary where the critical one falls.
- The learner should need trade knowledge, not wording cues, to spot a mistake. Vary how mistakes show up: at most one may be an announced shortcut ("not gonna bother with..."). The others should be stated matter-of-factly as what the apprentice is doing: a wrong part or material, a wrong order, a wrong method, or an important action plainly missing from a step that describes that part of the job.
- Give at least two correct steps a shortcut-sounding or casual tone that is actually fine, so tone alone doesn't give anything away.
- Each mistake must be detectable from the narration alone by someone who knows the trade, and grounded in standard practice and code (for example NEC, OSHA, EPA, manufacturer specs). Do not invent rules.
- Correct steps must be ones a journeyman would not stop: either include the normally required actions for that part of the job (for example replacing a filter drier after opening a refrigerant system) or keep the step narrow enough that nothing required is missing from it.

Mistake fields
- summary: under 10 words.
- why: one or two plain-language sentences.
- correctAction: what a journeyman would do instead, one sentence, in words that read well aloud (no parentheses or abbreviations).
- consequence: one or two sentences describing what realistically happened next because nobody stopped it. Serious but not gory, and matching the severity.
- keywords: 8 to 12 lowercase words, word stems, or short phrases a learner might say out loud when correctly explaining the mistake, including casual and slang wording (for example "juice", "nitro", "fire bottle"). Prefer stems that cover word forms ("purg" for purge and purging). Do not include words that appear in that step's narration line.

Other fields
- id: a short kebab-case id. trade: the trade id you were given. apprentice: a first name. setting: one sentence about the jobsite.`;

const APPRENTICE_NAMES = ['Danny', 'Marcus', 'Jess', 'Priya', 'Luis', 'Tasha', 'Kenji', 'Ava', 'Rob', 'Mo'];
const DEFAULT_TWISTS = [
  'the homeowner is watching and chatty',
  'it is getting dark',
  'a part from the truck is the wrong size',
  'the previous work was done by a handyman'
];
const pick = (a, rng) => a[Math.floor(rng() * a.length)];

// Opus 5.5 rejects sampling params, so variety comes from the input: a random
// critical hazard area (trade.criticalHints, else one of trade.hazardHints), jobsite twist, and apprentice name on every call.
// recentSummaries (optional) lists mistakes from recent scenarios to avoid.
// rng (optional) is injectable so tests and the golden harness get a deterministic prompt.
export function scenarioUserPrompt(tradeId, trade, recentSummaries = [], rng = Math.random) {
  const hints = (Array.isArray(trade.criticalHints) && trade.criticalHints.length
    ? trade.criticalHints
    : String(trade.hazardHints ?? '').split(',')).map(s => String(s).trim()).filter(Boolean);
  const twists = Array.isArray(trade.twists) && trade.twists.length ? trade.twists : DEFAULT_TWISTS;
  const recent = Array.isArray(recentSummaries) ? recentSummaries.filter(s => typeof s === 'string' && s.trim()) : [];
  return `Trade id: ${tradeId}
Job: ${trade.brief}
Hazard areas to draw mistakes from: ${trade.hazardHints}
Draw the critical mistake from: ${hints.length ? pick(hints, rng) : 'any of the hazard areas'}
Jobsite twist to include: ${pick(twists, rng)}
Apprentice name: ${pick(APPRENTICE_NAMES, rng)}
${recent.length ? `Do not reuse these mistakes from recent scenarios: ${recent.join('; ')}\n` : ''}
Write a fresh scenario.`;
}

// Synthetic, subject-free entries for the fingerprint: with and without
// criticalHints, with twists, with recent summaries, and with no hints at all.
// rng () => 0 makes every render deterministic.
const fpRng = () => 0;
const FP_ENTRY = { brief: 'Hang a heavy mirror on a plaster wall.', hazardHints: 'hidden pipes, hidden cables, falling glass' };

export const PROMPT = {
  id: 'scenario',
  system: SCENARIO_SYSTEM,
  schema: SCENARIO_SCHEMA,
  render: (i) => scenarioUserPrompt(i.key, i.entry, i.recentSummaries ?? [], i.rng),
  fingerprintInputs: [
    { key: 'demo-hanging', entry: { ...FP_ENTRY, criticalHints: ['hidden cables behind the wall', 'a ladder on a wet floor'] }, rng: fpRng },
    { key: 'demo-hanging', entry: FP_ENTRY, rng: fpRng },
    { key: 'demo-hanging', entry: { ...FP_ENTRY, twists: ['the owner keeps moving the mirror', 'the drill battery is low'] }, rng: fpRng },
    { key: 'demo-hanging', entry: FP_ENTRY, recentSummaries: ['Did not check behind the wall', 'Used the wrong wall plug'], rng: fpRng },
    { key: 'demo-blank', entry: { brief: 'Fold a stack of towels.', hazardHints: '' }, rng: fpRng }
  ]
};
