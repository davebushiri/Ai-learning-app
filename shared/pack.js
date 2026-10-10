// Pack format v1 (ADR 0006 + Amendment 1). Pure and browser-safe: no node: imports.
//
// All pack text is untrusted, whoever wrote it, so validatePack checks shape
// and caps sizes before anything else reads the pack. It never throws: a bad
// pack is skipped with its problems logged, and the server still starts.

export const RATING_KEYS = ['missedCritical', 'tier0', 'tier1', 'tier2', 'tier3'];

const LIMITS = { scenarios: 50, string: 2000, synonymTerms: 200, synonymForms: 20, tiers: 4 };
const ID_RE = /^[a-z0-9-]{1,40}$/;
const FIXTURE_RE = /^[a-z0-9-]+\.json$/;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export function validatePack(p) {
  const problems = [];
  try {
    check(p, problems);
  } catch (err) {
    // Belt and braces: a getter or proxy in hostile input must not crash the caller.
    problems.push(`pack could not be read: ${err?.name ?? 'error'}`);
  }
  return problems;
}

function check(p, problems) {
  if (!isObj(p)) { problems.push('pack must be an object'); return; }
  const str = (v, path, { required = true } = {}) => {
    if (v === undefined && !required) return;
    if (typeof v !== 'string' || !v.trim()) problems.push(`${path} must be a non-empty string`);
    else if (v.length > LIMITS.string) problems.push(`${path} is longer than ${LIMITS.string} chars`);
  };
  const strList = (v, path, max) => {
    if (!Array.isArray(v)) { problems.push(`${path} must be an array`); return; }
    if (v.length > max) problems.push(`${path} has more than ${max} entries`);
    v.slice(0, max).forEach((s, i) => str(s, `${path}[${i}]`));
  };
  const obj = (v, path) => {
    if (isObj(v)) return true;
    problems.push(`${path} must be an object`);
    return false;
  };

  if (typeof p.id !== 'string' || !ID_RE.test(p.id)) problems.push('id must match ^[a-z0-9-]{1,40}$');
  if (!Number.isInteger(p.version) || p.version < 1) problems.push('version must be an integer >= 1');
  str(p.title, 'title');

  if (obj(p.severity, 'severity')) for (const k of ['critical', 'major', 'minor']) str(p.severity[k], `severity.${k}`);

  if (obj(p.ratings, 'ratings')) {
    str(p.ratings.missedCritical, 'ratings.missedCritical');
    if (!Array.isArray(p.ratings.tiers) || p.ratings.tiers.length !== LIMITS.tiers) {
      problems.push(`ratings.tiers must be an array of exactly ${LIMITS.tiers} labels`);
    } else strList(p.ratings.tiers, 'ratings.tiers', LIMITS.tiers);
  }

  if (obj(p.copy, 'copy')) {
    str(p.copy.cleanRun, 'copy.cleanRun');
    str(p.copy.falseAlarmFeedback, 'copy.falseAlarmFeedback');
  }

  if (p.grading !== undefined && obj(p.grading, 'grading') && p.grading.synonyms !== undefined
      && obj(p.grading.synonyms, 'grading.synonyms')) {
    const terms = Object.keys(p.grading.synonyms);
    if (terms.length > LIMITS.synonymTerms) problems.push(`grading.synonyms has more than ${LIMITS.synonymTerms} terms`);
    for (const term of terms.slice(0, LIMITS.synonymTerms)) {
      str(term, `grading.synonyms key "${term.slice(0, 40)}"`);
      strList(p.grading.synonyms[term], `grading.synonyms.${term.slice(0, 40)}`, LIMITS.synonymForms);
    }
  }

  if (!Array.isArray(p.scenarios) || p.scenarios.length === 0) {
    problems.push('scenarios must be a non-empty array');
  } else {
    if (p.scenarios.length > LIMITS.scenarios) problems.push(`scenarios has more than ${LIMITS.scenarios} entries`);
    const seen = new Set();
    p.scenarios.slice(0, LIMITS.scenarios).forEach((s, i) => {
      const at = `scenarios[${i}]`;
      if (!obj(s, at)) return;
      if (typeof s.id !== 'string' || !ID_RE.test(s.id)) problems.push(`${at}.id must match ^[a-z0-9-]{1,40}$`);
      else if (seen.has(s.id)) problems.push(`${at}.id "${s.id}" is a duplicate`);
      else seen.add(s.id);
      str(s.label, `${at}.label`);
      str(s.brief, `${at}.brief`);
      // Required (FR-019): the scenario prompt prints it verbatim, so a missing
      // one would put "undefined" in the prompt (F1a-B15).
      str(s.hazardHints, `${at}.hazardHints`);
      if (s.criticalHints !== undefined) strList(s.criticalHints, `${at}.criticalHints`, LIMITS.scenarios);
      if (s.twists !== undefined) strList(s.twists, `${at}.twists`, LIMITS.scenarios);
      if (typeof s.fixture !== 'string' || !FIXTURE_RE.test(s.fixture)) {
        problems.push(`${at}.fixture must match ^[a-z0-9-]+\\.json$`);
      }
    });
  }

  if (obj(p.provenance, 'provenance')) str(p.provenance.builtBy, 'provenance.builtBy');
}

// Maps a scoreRun ratingKey to the pack's label; null for anything unknown.
export function ratingLabel(ratings, key) {
  if (!isObj(ratings)) return null;
  let label;
  if (key === 'missedCritical') label = ratings.missedCritical;
  else {
    const m = typeof key === 'string' ? /^tier([0-3])$/.exec(key) : null;
    if (m && Array.isArray(ratings.tiers)) label = ratings.tiers[Number(m[1])];
  }
  return typeof label === 'string' ? label : null;
}
