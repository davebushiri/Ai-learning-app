// Pure helpers for the practice page: no DOM, no window, Node-importable.
// The browser never decides detection or grades (FR-005); these only turn
// server responses into the exact strings that are shown and spoken.
import { COPY } from './copy.js';
import { ApiError } from './api.js';

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

// A not-graded item (a stop skipped after err.net, FR-009a) is never called a miss (PD-5).
export function missedLine(item) {
  const key = item?.notGraded === true ? 'missed.notGraded' : 'missed.item';
  return fill(COPY[key], { text: item?.text, whyWrong: item?.whyWrong, correctedText: item?.correctedText })
    .replace(/\s+/g, ' ').trim();
}

// FR-008: one id per STOP press, re-sent on Try again so the server can spot the repeat.
// Always matches the server's ^[A-Za-z0-9_-]{8,64}$.
export function newStopId() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const bytes = c.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

// FR-009a: the complete body. Keys are left out when there is nothing to say.
export function completeRequest(lastStatementId, skipped) {
  const body = {};
  if (lastStatementId != null) body.lastStatementId = lastStatementId;
  if (Array.isArray(skipped) && skipped.length) body.skipped = skipped;
  return body;
}

// FR-059 (F1c-B23): one skip entry per statement, keeping the smallest elapsedMs. The
// server attributes no better from a larger one, and the list then never exceeds the
// narration length, so the server's 20-entry cap can't be hit by repeated skips.
export function recordSkip(skipped, entry) {
  const list = Array.isArray(skipped) ? skipped.map(e => ({ ...e })) : [];
  const id = entry?.statementId;
  if (typeof id !== 'string' || !id) return list;
  const i = list.findIndex(e => e.statementId === id);
  if (i < 0) return [...list, { statementId: id, elapsedMs: entry.elapsedMs }];
  if (smaller(entry.elapsedMs, list[i].elapsedMs)) list[i].elapsedMs = entry.elapsedMs;
  return list;
}
// A non-finite value counts as larger than any finite one.
const smaller = (a, b) => Number.isFinite(a) && (!Number.isFinite(b) || a < b);

// FR-060: a 4xx can't be fixed by trying again, so it isn't a network error.
// Typed class and status only, never the message text.
export function errorKind(err) {
  return err instanceof ApiError && err.status >= 400 && err.status <= 499 ? 'rejected' : 'net';
}

// FR-035: what is spoken must equal the element's normalized textContent.
export const normalize = s => String(s).replace(/\s+/g, ' ').trim();
