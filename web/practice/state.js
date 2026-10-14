// Pure helpers for the practice page: no DOM, no window, Node-importable.
// The browser never decides detection or grades (FR-005); these only turn
// server responses into the exact strings that are shown and spoken.
import { COPY } from './copy.js';

// Single pass, so a value containing "{x}" is never filled again.
export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k] ?? '') : m));
}

// FR-037: a hit moves on; a late hit or false interruption replays the interrupted statement.
export function resumeIndex(stopResponse, interruptedIndex) {
  return stopResponse?.detection === 'hit' ? interruptedIndex + 1 : interruptedIndex;
}

export function feedbackText(stopResponse) {
  const { detection, result, reveal } = stopResponse ?? {};
  if (detection !== 'hit' && detection !== 'late_hit') return COPY['fb.false'];
  const key = `fb.hit.${result?.overall}`;
  const body = fill(COPY[key] ?? COPY['fb.hit.uncertain'], { whyWrong: reveal?.whyWrong ?? '' }).trim();
  return detection === 'late_hit' ? `${COPY['fb.late.prefix']} ${body}` : body;
}

export function correctedLine(reveal) {
  return fill(COPY['say.corrected'], { correctedText: reveal?.correctedText ?? '' });
}

export function statusLabel(status) {
  return COPY[`status.${status}`] ?? COPY['status.uncertain'];
}

// Known dimensions first, in a fixed order; any other dimension keeps its name.
const DIM_ORDER = ['explanation', 'correction', 'transfer', 'tradeoffs', 'defense'];

export function dimNames(result) {
  if (!result || typeof result !== 'object') return [];
  const names = Object.keys(result).filter(k => k !== 'overall' && result[k] && typeof result[k] === 'object');
  return names.sort((a, b) => rank(a) - rank(b));
}
const rank = n => (DIM_ORDER.includes(n) ? DIM_ORDER.indexOf(n) : DIM_ORDER.length);

export function dimLines(result) {
  return dimNames(result).map(n => `${COPY[`dim.${n}`] ?? n}: ${statusLabel(result[n].status)}`);
}

// Rubric items for one dimension at the reveal: matched, then missing. '|' alternatives read as "a / b".
export function rubricLines(dim) {
  const show = item => String(item).split('|').join(' / ');
  return [
    ...(dim?.matched ?? []).map(i => `${COPY['status.met']}: ${show(i)}`),
    ...(dim?.missing ?? []).map(i => `${COPY['status.not_met']}: ${show(i)}`)
  ];
}

// "Caught" counts on-time and late hits (both are catches).
export function summaryLine(summary) {
  if (summary?.cleanPass) return COPY['end.clean'];
  const f = summary?.falseInterruptions ?? 0;
  return fill(COPY['sum.line'], {
    hits: (summary?.hits ?? 0) + (summary?.lateHits ?? 0),
    planted: summary?.planted ?? 0,
    misses: summary?.misses ?? 0,
    f,
    s: f === 1 ? '' : 's'
  });
}

export function missedLine(item) {
  return fill(COPY['missed.item'], { text: item?.text, whyWrong: item?.whyWrong, correctedText: item?.correctedText })
    .replace(/\s+/g, ' ').trim();
}

// FR-035: what is spoken must equal the element's normalized textContent.
export const normalize = s => String(s).replace(/\s+/g, ' ').trim();
