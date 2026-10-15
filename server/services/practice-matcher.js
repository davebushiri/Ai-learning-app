// F1c rubric-concept matcher (the offline grader, ADR 0008 ARCH-5 a and ARCH-7).
// Server-only, synchronous and pure. It reimplements the shared/mock-grader.js techniques
// (normalize, light stemming, word-start matching, the keyword-stuffing guard) on token
// streams instead of regexes, so negation can be checked by position (PD-2).
// It holds no subject words: any vocabulary comes from the pack's lexicon.
// Any change to these rules bumps MATCHER_VERSION (FR-014).

export const MATCHER_VERSION = 'matcher@3';

export const MATCHER_RULES = Object.freeze({
  itemCoverage: 0.6,
  metRatio: 2 / 3,
  epsilon: 1e-9,
  minWords: 3,
  longAnswerWords: 20,
  negationWindow: 3,
  echoCoverage: 0.8,
  stuffedMaxRest: 2,
  stuffedMaxFunctionShare: 0.2,
  maxAlternatives: 8,
  negators: Object.freeze(['not', 'no', 'never', 'isnt', 'arent', 'doesnt', 'dont', 'didnt',
    'cannot', 'cant', 'wont', 'wouldnt', 'shouldnt', 'without', 'havent', 'hasnt', 'wasnt', 'werent'])
});

const R = MATCHER_RULES;
const NEGATORS = new Set(R.negators);
// Generic English function words. Quantity and comparison words (more, less, only, same,
// every, different) stay content tokens because rubric items lean on them. The filter
// guarantees no negator is ever a stopword (PD-2), whatever is added here later.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as', 'of', 'at', 'by',
  'for', 'from', 'in', 'into', 'on', 'onto', 'to', 'with', 'within', 'about', 'above', 'after',
  'against', 'along', 'among', 'around', 'before', 'behind', 'below', 'between', 'during',
  'over', 'through', 'under', 'until', 'upon', 'via', 'per',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did', 'doing',
  'have', 'has', 'had', 'having', 'it', 'its', 'itself', 'this', 'that', 'these', 'those',
  'there', 'here', 'they', 'them', 'their', 'theirs', 'we', 'us', 'our', 'ours', 'you', 'your',
  'yours', 'he', 'him', 'his', 'she', 'her', 'hers', 'me', 'my', 'mine', 'what', 'which',
  'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
  'either', 'some', 'such', 'own', 'just', 'also', 'very', 'too', 'can', 'could', 'would',
  'should', 'will', 'shall', 'may', 'might', 'must', 'ok', 'okay', 'yes', 'yeah', 'oh',
  'well', 'really', 'still', 'even', 'ever', 'again', 'im', 'thats', 'theres'
].filter(w => !NEGATORS.has(w)));

const STATUS_ORDER = ['not_met', 'partial', 'met'];
const SUFFIXES = new Set(['', 's', 'es', 'ed', 'ing']);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = v => (Array.isArray(v) ? v.filter(s => typeof s === 'string' && s.trim()) : []);
const words = t => (typeof t === 'string' ? t : '').toLowerCase().replace(/[’'`]/g, '')
  .split(/[^a-z0-9]+/).filter(Boolean);
const contentTokens = t => words(t).filter(w => w.length >= 2 && !STOPWORDS.has(w));

// Light stemming as in mock-grader, plus a plain plural on 4-letter words ("runs" → "run").
const stem = k => (k.length > 4 ? k.replace(/(ing|ed|es|e|s)$/, '')
  : k.length === 4 && /[^s]s$/.test(k) ? k.slice(0, -1) : k);

// Word-start match: "tested" hits "test", "online" does not hit "line". Short forms
// (≤ 3 chars) must be the whole word, give or take a suffix.
function tokenMatch(answerToken, itemToken) {
  if (itemToken.length <= 3) {
    return answerToken.startsWith(itemToken) && SUFFIXES.has(answerToken.slice(itemToken.length));
  }
  return answerToken.startsWith(stem(itemToken));
}

function normalizeLexicon(lexicon) {
  const syn = isObj(lexicon) && isObj(lexicon.synonyms) ? lexicon.synonyms : {};
  const out = [];
  for (const [key, forms] of Object.entries(syn)) {
    const k = contentTokens(key);
    if (k.length !== 1) continue; // a lexicon key names one token
    const fs = strings(forms).map(contentTokens).filter(f => f.length);
    if (fs.length) out.push({ key: k[0], forms: fs });
  }
  return out;
}

// One answer, tokenized once. The negation window counts every word, stopwords included,
// and stops at a sentence or clause break (. ; : ! ?), so "Not quite. The X" negates nothing.
function makeAnswer(text, lexicon) {
  const raw = [];
  (typeof text === 'string' ? text : '').split(/[.;:!?]+/).forEach((clause, c) => {
    for (const w of words(clause)) raw.push({ w, c });
  });
  const tokens = [];
  const rawAt = [];
  raw.forEach(({ w }, i) => { if (w.length >= 2 && !STOPWORDS.has(w)) { tokens.push(w); rawAt.push(i); } });
  // FR-019(b): a keyword list has no grammar, so its share of function words is low.
  const functionShare = raw.length ? raw.filter(({ w }) => STOPWORDS.has(w)).length / raw.length : 0;
  const negatedAt = pos => {
    const r = rawAt[pos];
    for (let p = Math.max(0, r - R.negationWindow); p < r; p++) {
      if (raw[p].c === raw[r].c && NEGATORS.has(raw[p].w)) return true;
    }
    return false;
  };
  const hasNegator = tokens.some(t => NEGATORS.has(t));
  return { tokens, negatedAt, lexicon, functionShare, hasNegator };
}

// Every occurrence of an item token in the answer, directly or through a lexicon form,
// as arrays of answer positions.
function occurrences(ans, itemToken) {
  const occ = [];
  const { tokens } = ans;
  tokens.forEach((a, i) => { if (tokenMatch(a, itemToken)) occ.push([i]); });
  for (const { key, forms } of ans.lexicon) {
    if (key !== itemToken && stem(key) !== stem(itemToken)) continue;
    for (const f of forms) {
      for (let i = 0; i + f.length <= tokens.length; i++) {
        if (f.every((ft, j) => tokenMatch(tokens[i + j], ft))) occ.push(f.map((_, j) => i + j));
      }
    }
  }
  return occ;
}

// FR-017: an alternative with n content tokens matches when ceil(0.6n − ε) of them appear
// (n ≤ 2 needs all). A token counts as negated only if every occurrence is negated.
// matcher@3 (R2): an alternative carrying a negator needs some negator in the answer, so a
// positive restatement can't match a negated alternative on its other tokens alone.
function matchAlternative(ans, alt) {
  const toks = contentTokens(alt);
  if (!toks.length) return null;
  if (toks.some(t => NEGATORS.has(t)) && !ans.hasNegator) return null;
  const need = toks.length <= 2 ? toks.length : Math.ceil(toks.length * R.itemCoverage - R.epsilon);
  const found = toks.map(t => occurrences(ans, t)).filter(o => o.length);
  if (found.length < need) return null;
  return {
    hasNegator: toks.some(t => NEGATORS.has(t)),
    negated: found.some(o => o.every(positions => ans.negatedAt(positions[0]))),
    positions: found.flat(2)
  };
}

// C1: an item matches through any of its first 8 '|' alternatives. PD-2: the negation check
// is skipped when a matched alternative itself contains a negator.
function matchItem(ans, item, split = true) {
  const alts = split ? item.split('|').slice(0, R.maxAlternatives) : [item];
  const hits = alts.map(a => matchAlternative(ans, a)).filter(Boolean);
  if (!hits.length) return null;
  return {
    negated: hits.every(h => !h.hasNegator && h.negated),
    positions: hits.flatMap(h => h.positions)
  };
}

function gradeItems(ans, items) {
  const out = { matched: [], missing: [], negated: false, positions: [] };
  for (const item of items) {
    const m = matchItem(ans, item);
    if (!m) { out.missing.push(item); continue; }
    out.matched.push(item);
    out.negated ||= m.negated;
    out.positions.push(...m.positions);
  }
  return out;
}

// FR-018: met at ceil(n × 2/3 − ε) matched items, partial at ≥ 1.
function countStatus(matched, n) {
  if (n === 0 || matched === 0) return 'not_met';
  return matched >= Math.ceil(n * R.metRatio - R.epsilon) ? 'met' : 'partial';
}

const lower = (a, b) => (STATUS_ORDER.indexOf(a) <= STATUS_ORDER.indexOf(b) ? a : b);

function gradeDimension(ans, d, removed) {
  const items = strings(d.items);
  const base = gradeItems(ans, items);
  let status = countStatus(base.matched.length, items.length);
  let negated = base.negated;
  let anyMatched = base.matched.length > 0;
  base.positions.forEach(p => removed.add(p));

  // FR-020: any acceptable correction, matched as a single item, makes the dimension met.
  for (const alt of strings(d.alternatives)) {
    const m = matchItem(ans, alt, false);
    if (!m) continue;
    base.matched.push(alt);
    status = 'met';
    anyMatched = true;
    negated ||= m.negated;
    m.positions.forEach(p => removed.add(p));
    break;
  }

  // FR-043 / C2: design = lower of mustCover and the best architecture that has mustInclude.
  let architectureId = null;
  const archs = (Array.isArray(d.architectures) ? d.architectures : [])
    .filter(a => isObj(a) && strings(a.mustInclude).length);
  if (archs.length) {
    let best = null;
    for (const a of archs) {
      const inc = strings(a.mustInclude);
      const g = gradeItems(ans, inc);
      const s = countStatus(g.matched.length, inc.length);
      if (!best || STATUS_ORDER.indexOf(s) > STATUS_ORDER.indexOf(best.status)) best = { a, g, status: s };
    }
    status = lower(status, best.status);
    if (best.status !== 'not_met') {
      architectureId = typeof best.a.id === 'string' ? best.a.id : null;
      anyMatched = true;
      negated ||= best.g.negated;
      best.g.positions.forEach(p => removed.add(p));
    }
  }
  return { status, matched: base.matched, missing: base.missing, negated, anyMatched, architectureId };
}

// Red flags and strong signals count only when matched and not negated (FR-022, PD-2).
function unnegatedMatches(ans, list) {
  return strings(list).filter(item => {
    const m = matchItem(ans, item);
    return m && !m.negated;
  });
}

function grade(input) {
  const inp = isObj(input) ? input : {};
  const ans = makeAnswer(typeof inp.answer === 'string' ? inp.answer : '', normalizeLexicon(inp.lexicon));
  const dims = isObj(inp.dimensions) ? inp.dimensions : {};
  const removed = new Set();
  const graded = {};
  let architectureId = null;
  for (const [name, d] of Object.entries(dims)) {
    if (!isObj(d)) continue;
    graded[name] = gradeDimension(ans, d, removed);
    architectureId ??= graded[name].architectureId;
  }

  const total = ans.tokens.length;
  // FR-019 (matcher@2): only a keyword list is capped: few leftover words and little grammar.
  const stuffed = total - removed.size <= R.stuffedMaxRest && ans.functionShare < R.stuffedMaxFunctionShare;
  const redFlagsMatched = unnegatedMatches(ans, inp.redFlags);
  const strongSignalsMatched = unnegatedMatches(ans, inp.strongSignals);

  // FR-021(c): echoing the flawed statement without any correction is uncertain.
  const flawed = contentTokens(typeof inp.flawedText === 'string' ? inp.flawedText : '');
  const covered = flawed.filter(t => ans.tokens.some(a => tokenMatch(a, t))).length;
  const echo = flawed.length > 0 && covered / flawed.length >= R.echoCoverage - R.epsilon
    && !graded.correction?.anyMatched;

  const out = {};
  for (const [name, g] of Object.entries(graded)) {
    let status;
    if (total < R.minWords) status = 'not_met';
    else if (redFlagsMatched.length || echo || g.negated) status = 'uncertain';
    else if (!g.anyMatched && total >= R.longAnswerWords) status = 'uncertain';
    else status = stuffed && g.status === 'met' ? 'partial' : g.status;
    out[name] = { status, matched: g.matched, missing: g.missing, confidence: status === 'uncertain' ? 'low' : 'high' };
  }
  return {
    dimensions: out, redFlagsMatched, strongSignalsMatched, architectureId,
    graderSource: 'matcher', graderVersion: MATCHER_VERSION
  };
}

/** Synchronous, pure grader (FR-023 seam). Never throws: a bug degrades to "uncertain". */
export function matcherGrade(input) {
  try {
    return grade(input);
  } catch {
    const dims = isObj(input) && isObj(input.dimensions) ? input.dimensions : {};
    const out = {};
    for (const name of Object.keys(dims)) out[name] = { status: 'uncertain', matched: [], missing: [], confidence: 'low' };
    return { dimensions: out, redFlagsMatched: [], strongSignalsMatched: [], architectureId: null, graderSource: 'matcher', graderVersion: MATCHER_VERSION };
  }
}

/** FR-042: index of the first clarification whose askAbout items match the question, or null. */
export function matchClarification(question, clarifications, lexicon) {
  if (!Array.isArray(clarifications)) return null;
  const ans = makeAnswer(typeof question === 'string' ? question : '', normalizeLexicon(lexicon));
  const i = clarifications.findIndex(c => isObj(c) && strings(c.askAbout).some(item => matchItem(ans, item)));
  return i === -1 ? null : i;
}

/** FR-011: uncertain wins; met if all met; not_met if all not_met; otherwise partial. */
export function combineOverall(dims) {
  const s = (Array.isArray(dims) ? dims : []).map(d => (isObj(d) ? d.status : undefined));
  if (!s.length) return 'not_met';
  if (s.includes('uncertain')) return 'uncertain';
  if (s.every(x => x === 'met')) return 'met';
  if (s.every(x => x === 'not_met')) return 'not_met';
  return 'partial';
}
