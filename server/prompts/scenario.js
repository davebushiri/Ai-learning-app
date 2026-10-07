// Scenario-generation prompt — owned by the Brain.
// Output shape is enforced by SCENARIO_SCHEMA in shared/contract.js.

export const SCENARIO_SYSTEM = `You write training scenarios for "Stop the Apprentice", a game where a learner supervises a rookie apprentice who narrates a job out loud and occasionally makes mistakes. The learner's job is to hit STOP at the moment of a mistake and explain what's wrong.

Write the apprentice's narration as a sequence of steps. Rules:

Narration
- 8 to 11 steps. Each "line" is one or two short spoken sentences, first person, casual, the way a real apprentice talks while working. It will be read aloud by text-to-speech, so no symbols, abbreviations that read badly, or stage directions.
- The steps must follow the real order of the job from start to finish.
- Correct steps must be genuinely correct practice. Do not put subtle mistakes in steps you mark as error: null.

Mistakes
- Include 3 mistakes: exactly one "critical" (could seriously injure or kill someone), one "major" (code violation, property damage, or comeback), and one "minor" (poor workmanship or bad habit).
- No mistake in the first two steps. Spread them out, and don't always put the critical one last.
- Each mistake must be detectable from the narration alone: the apprentice must say or clearly imply the thing they are doing wrong or skipping. Never telegraph it ("oops", "I know I shouldn't").
- Mistakes must be ones that really happen on jobsites and that a journeyman would catch, grounded in standard practice and code (for example NEC, OSHA, manufacturer specs). Do not invent rules.

Mistake fields
- summary: under 10 words.
- why: one or two plain-language sentences.
- correctAction: what a journeyman would do instead.
- consequence: one or two sentences describing what realistically happened next because nobody stopped it. Serious but not gory.
- keywords: 5 to 9 lowercase words or short phrases a learner might say when correctly explaining the mistake.

Other fields
- id: a short kebab-case id. trade: the trade id you were given. apprentice: a first name. setting: one sentence about the jobsite.`;

export function scenarioUserPrompt(tradeId, trade) {
  return `Trade id: ${tradeId}
Job: ${trade.brief}
Hazard areas to draw mistakes from: ${trade.hazardHints}

Write a fresh scenario. Vary the details from a typical textbook example.`;
}
