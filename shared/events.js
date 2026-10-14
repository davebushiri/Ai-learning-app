// Event schema v1 (ADR 0002 + Amendments 1, 2, 3). Pure and browser-safe: no Node imports.
// Events are xAPI-shaped: {id, at, actor, verb, object, result, context}.

// data-and-evidence.md §1, the full vocabulary. F1 writes only six of these (ADR 0002), but a
// reader must accept every verb ever written, so validation accepts them all.
export const VERBS = Object.freeze([
  'planned', 'started', 'step-shown', 'resumed', 'abandoned', 'completed',
  'stopped', 'explained', 'graded', 'chose',
  'flagged', 'rated-fairness', 'probe-answered',
  'mode-assigned', 'mode-switched', 'mode-fallback', 'voice-command', 'stt-corrected',
  'subject-built', 'subject-edited', 'map-change-accepted',
  // Practice engine (ADR 0002 Amendment 3): new verbs, not reuses of rated-fairness or chose.
  'self-rated', 'assisted', 'clarified'
]);

export const OUTCOMES = Object.freeze(['caught', 'caught_late', 'wrong_reason', 'missed', 'false_alarm', 'clean_pass']);

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

// `<prefix>_` + ULID: 10 chars of millisecond time, then 16 chars (80 bits) of randomness.
// Ids are unique but not ordered within one millisecond; order is always `seq` (ADR 0002 Am. 1).
export function newId(prefix) {
  let time = '';
  for (let t = Date.now(), i = 0; i < 10; i++, t = Math.floor(t / 32)) time = CROCKFORD[t % 32] + time;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let rand = '';
  for (const b of bytes) rand += CROCKFORD[b & 31]; // 5 bits per byte keeps the alphabet uniform
  return `${prefix}_${time}${rand}`;
}

export function makeEvent({ verb, object, result = null, context, actor = 'learner_1', at = new Date().toISOString() }) {
  return { id: newId('evt'), at, actor, verb, object, result, context };
}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = v => typeof v === 'string' && v.length > 0;

// Returns a list of problems; empty means valid. Never throws, whatever it is given.
export function validateEvent(e) {
  try {
    if (!isObj(e)) return ['event must be an object'];
    const problems = [];
    if (!isText(e.id)) problems.push('id must be a non-empty string');
    if (!isText(e.at) || Number.isNaN(Date.parse(e.at))) problems.push('at must be an ISO timestamp');
    if (!isText(e.actor)) problems.push('actor must be a non-empty string');
    if (!VERBS.includes(e.verb)) problems.push(`unknown verb: ${String(e.verb)}`);
    if (!isObj(e.object)) problems.push('object must be an object');
    else {
      if (!isText(e.object.type)) problems.push('object.type must be a non-empty string');
      if (!isText(e.object.id)) problems.push('object.id must be a non-empty string');
    }
    if (e.result !== null && !isObj(e.result)) problems.push('result must be an object or null');
    if (!isObj(e.context)) problems.push('context must be an object');
    else {
      if (!isText(e.context.subject)) problems.push('context.subject must be a non-empty string');
      if (!isText(e.context.attemptId)) problems.push('context.attemptId must be a non-empty string');
      if (!isObj(e.context.promptVersions)) problems.push('context.promptVersions must be an object');
    }
    return problems;
  } catch {
    return ['event is unreadable'];
  }
}
