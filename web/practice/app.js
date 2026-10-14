// Practice page, text-mode catch-and-correct loop (F1c-T05).
// Renders only what /api/practice/* sends; never grades or attributes (FR-005).
// Holds no browser storage: the server's event log is the record.
import * as api from './api.js';
import { COPY } from './copy.js';
import {
  resumeIndex, feedbackText, correctedLine, dimNames, dimLines, rubricLines, summaryLine, missedLine, newStopId, completeRequest
} from './state.js';
import { speak, stopSpeaking } from './speech.js';

const $ = id => document.getElementById(id);
const voiceOn = () => $('voice-toggle').checked;
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const show = (id, on = true) => { $(id).hidden = !on; };

// One session at a time. `gen` invalidates any narration or speech chain still awaiting.
const S = {
  phase: 'picker', track: null, attemptId: null, exercise: null, assistAllowed: false, assisted: false,
  index: 0, reached: -1, statementStart: 0, stop: null, pending: false, gen: 0,
  skipped: [] // stops skipped after err.net, sent at complete so they are never scored as misses (FR-009a)
};

// Shown and spoken from the same string (FR-035). Resolves after speech, or at once in text mode.
function say(node, text) {
  node.textContent = text;
  return voiceOn() ? speak(text) : Promise.resolve();
}

/* ---------- picker ---------- */

async function loadPicker() {
  let tracks;
  try {
    tracks = await api.fetchTracks();
  } catch (err) {
    console.warn('tracks failed', err);
    $('picker-msg').textContent = "Couldn't reach the server.";
    return;
  }
  const list = $('track-list');
  list.replaceChildren();
  if (!tracks.length) { $('picker-msg').textContent = COPY['picker.empty']; return; }
  for (const t of tracks) {
    const b = el('button', t.title, 'secondary');
    b.type = 'button';
    b.dataset.track = t.id;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => pickTrack(t.id));
    const li = el('li');
    li.append(b);
    list.append(li);
  }
  if (tracks.length === 1) pickTrack(tracks[0].id, { focus: false });
}

async function pickTrack(id, { focus = true } = {}) {
  for (const b of $('track-list').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.track === id));
  $('picker-msg').textContent = '';
  let track;
  try {
    track = await api.fetchTrack(id);
  } catch (err) {
    console.warn('track failed', err);
    $('picker-msg').textContent = "Couldn't reach the server.";
    return;
  }
  S.track = track.id;
  const box = $('exercise-list');
  box.replaceChildren();
  for (const m of track.modules ?? []) {
    // Wave A plays catch exercises only; other types arrive with F1c-T09.
    const exercises = (m.exercises ?? []).filter(e => e.type === 'catch');
    if (!exercises.length) continue;
    const ul = el('ul');
    for (const e of exercises) {
      const b = el('button', e.objective, 'secondary');
      b.type = 'button';
      b.dataset.exercise = e.id;
      b.addEventListener('click', () => start(e.id));
      const li = el('li');
      li.append(b);
      ul.append(li);
    }
    box.append(el('h3', m.title), ul);
  }
  if (focus) box.querySelector('button')?.focus();
}

function openPicker() {
  S.gen++;
  stopSpeaking();
  S.phase = 'picker';
  for (const id of ['narration-screen', 'answer-panel', 'net-error', 'feedback-panel', 'reveal']) show(id, false);
  show('picker-screen');
  $('picker-title').focus();
}

/* ---------- narration ---------- */

async function start(exerciseId) {
  $('picker-msg').textContent = '';
  let res;
  try {
    res = await api.startAttempt({ track: S.track, exercise: exerciseId });
  } catch (err) {
    console.warn('start failed', err);
    $('picker-msg').textContent = "Couldn't reach the server.";
    return;
  }
  Object.assign(S, {
    attemptId: res.attemptId, exercise: res.exercise, assistAllowed: Boolean(res.assistAllowed),
    assisted: false, index: 0, reached: -1, stop: null, pending: false, skipped: []
  });
  show('picker-screen', false);
  show('reveal', false);
  show('narration-screen');
  $('exercise-title').textContent = res.exercise.objective;
  $('statements').replaceChildren();
  $('end-msg').textContent = '';
  $('reference').textContent = '';
  $('assist-msg').textContent = '';
  show('reference-box', false);
  $('assist-btn').textContent = COPY['btn.assist'];
  show('assist-btn', S.assistAllowed);
  $('assist-btn').disabled = false;
  show('stop-btn');
  show('stop-hint');
  $('stop-btn').focus();

  const gen = ++S.gen;
  S.phase = 'intro';
  await say($('intro'), COPY['intro.catch']);
  if (gen !== S.gen) return;
  narrateFrom(0);
}

function statementLi(i) {
  const list = $('statements');
  while (list.children.length <= i) {
    const st = S.exercise.narration[list.children.length];
    const li = el('li');
    li.dataset.statementId = st.id;
    li.append(el('span', st.text, 'text'));
    list.append(li);
  }
  return list.children[i];
}

async function narrateFrom(i) {
  const gen = ++S.gen;
  S.phase = 'narrating';
  show('stop-btn');
  show('stop-hint');
  const narration = S.exercise.narration ?? [];
  for (; i < narration.length; i++) {
    const li = statementLi(i);
    for (const n of $('statements').children) n.classList.remove('current', 'interrupted');
    li.classList.add('current');
    S.index = i;
    S.reached = Math.max(S.reached, i);
    S.statementStart = performance.now();
    // Text mode still uses speak(): {enabled: false} waits at reading pace and STOP cuts the wait.
    await speak(narration[i].text, { enabled: voiceOn() });
    if (gen !== S.gen) return;
  }
  endNarration();
}

// FR-030: stopSpeaking() runs synchronously in the handler.
function onStop(via, eventTime) {
  if (S.phase !== 'narrating') return;
  stopSpeaking();
  const now = performance.now();
  S.gen++;
  const st = S.exercise.narration[S.index];
  S.stop = {
    statementId: st.id, statementIndex: S.index, stopId: newStopId(),
    elapsedMs: Math.max(0, Math.round(now - S.statementStart)), via,
    stopLatencyMs: Number.isFinite(eventTime) ? Math.max(0, Math.round(now - eventTime)) : null
  };
  const li = statementLi(S.index);
  li.classList.remove('current');
  li.classList.add('interrupted');
  openAnswer();
}

function openAnswer() {
  S.phase = 'answering';
  show('stop-btn', false);
  show('stop-hint', false);
  show('answer-panel');
  $('answer-input').value = '';
  $('submit-btn').disabled = false;
  $('answer-input').focus();
  say($('answer-prompt'), COPY['prompt.stop']);
}

/* ---------- stop, feedback ---------- */

async function submitStop() {
  if (S.phase !== 'answering' || S.pending) return;
  S.pending = true;
  $('submit-btn').disabled = true;
  // Try again re-sends this same S.stop, so the same stopId: the server answers a repeat
  // with the stored body and counts it once (FR-008).
  const { statementId, elapsedMs, via, stopLatencyMs, stopId } = S.stop;
  let res;
  try {
    res = await api.postStop(S.attemptId, { statementId, elapsedMs, answer: $('answer-input').value, via, stopLatencyMs, stopId });
  } catch (err) {
    console.warn('stop failed', err);
    S.pending = false;
    $('submit-btn').disabled = false;
    netError({ skip: true, retry: submitStop });
    return;
  }
  S.pending = false;
  showFeedback(res);
}

let retryAction = null;
function netError({ skip, retry }) {
  retryAction = retry;
  show('skip-btn', skip);
  show('net-error');
  $('retry-btn').focus();
  say($('net-error-msg'), COPY['err.net']);
}

async function showFeedback(res) {
  const gen = ++S.gen;
  S.phase = 'feedback';
  S.lastStop = res;
  show('answer-panel', false);
  show('feedback-panel');
  const text = feedbackText(res);
  const dims = dimLines(res.result);
  $('feedback-dims').replaceChildren(...dims.map(d => el('li', d)));
  const corrected = res.reveal ? correctedLine(res.reveal) : null;
  $('feedback-corrected').textContent = corrected ?? '';
  show('feedback-corrected', Boolean(corrected));
  if (corrected) {
    const idx = S.exercise.narration.findIndex(s => s.id === res.reveal.statementId);
    if (idx >= 0) {
      const li = statementLi(idx);
      li.classList.add('corrected');
      li.querySelector('.corrected-text')?.remove();
      li.append(el('span', corrected, 'corrected-text'));
    }
  }
  $('continue-btn').focus();
  // Spoken in display order: feedback, each dimension row, then the corrected statement.
  await say($('feedback-text'), text);
  if (!voiceOn()) return;
  const rows = [...$('feedback-dims').children];
  for (const row of rows) { if (gen !== S.gen) return; await speak(row.textContent); }
  if (corrected && gen === S.gen) await speak(corrected);
}

function onContinue() {
  if (S.phase !== 'feedback') return;
  stopSpeaking();
  show('feedback-panel', false);
  statementLi(S.stop.statementIndex).classList.remove('interrupted');
  $('stop-btn').focus();
  narrateFrom(resumeIndex(S.lastStop, S.stop.statementIndex));
}

function onSkip() {
  show('net-error', false);
  if (S.phase !== 'answering') return;
  S.skipped.push({ statementId: S.stop.statementId, elapsedMs: S.stop.elapsedMs });
  S.stop && statementLi(S.stop.statementIndex).classList.remove('interrupted');
  show('answer-panel', false);
  $('stop-btn').focus();
  narrateFrom(S.stop.statementIndex);
}

/* ---------- assist ---------- */

async function onAssist() {
  if (!S.assistAllowed || S.assisted || S.pending) return;
  $('assist-btn').disabled = true;
  let res;
  try {
    res = await api.postAssist(S.attemptId);
  } catch (err) {
    console.warn('assist failed', err);
    $('assist-btn').disabled = false;
    $('assist-msg').textContent = "Couldn't reach the server.";
    show('reference-box');
    return;
  }
  S.assisted = true;
  show('assist-btn', false);
  $('reference').textContent = (res.reference ?? []).map(r => r.text).join('\n\n');
  show('reference-box');
  const wasNarrating = S.phase === 'narrating';
  if (S.phase === 'answering') $('answer-input').focus(); else $('reference-title').focus();
  if (wasNarrating && voiceOn()) {
    // Speaking the notice would cut the statement anyway; replay it from the start afterwards.
    S.gen++;
    stopSpeaking();
    const gen = S.gen;
    await say($('assist-msg'), COPY['assist.spoken']);
    if (gen === S.gen && S.phase === 'narrating') narrateFrom(S.index);
  } else {
    say($('assist-msg'), COPY['assist.spoken']);
  }
}

/* ---------- end, reveal ---------- */

async function endNarration() {
  const gen = ++S.gen;
  S.phase = 'ending';
  for (const n of $('statements').children) n.classList.remove('current');
  show('stop-btn', false);
  show('stop-hint', false);
  show('assist-btn', false);
  await say($('end-msg'), COPY['end.catch']);
  if (gen !== S.gen) return;
  complete();
}

async function complete() {
  const last = S.exercise.narration[S.reached];
  let res;
  try {
    res = await api.postComplete(S.attemptId, completeRequest(last?.id ?? null, S.skipped));
  } catch (err) {
    console.warn('complete failed', err);
    netError({ skip: false, retry: complete });
    return;
  }
  showReveal(res);
}

function showReveal(res) {
  const gen = ++S.gen;
  S.phase = 'reveal';
  show('net-error', false);
  show('narration-screen', false);
  show('reveal');

  $('summary-line').textContent = summaryLine(res.summary);
  $('missed-list').replaceChildren(...(res.missed ?? []).map(m => el('li', missedLine(m))));
  $('reveal-reference').textContent = (res.reference ?? []).map(r => r.text).join('\n\n');

  $('sources-list').replaceChildren(...(res.sources ?? []).map(src => {
    const li = el('li');
    const a = el('a', src.title);
    a.href = src.url; // by property (C13); the validator admits https:// only
    a.rel = 'noopener noreferrer';
    a.target = '_blank';
    li.append(a);
    if (src.verified === false) li.append(` ${COPY['src.unverified']}`);
    return li;
  }));

  const answered = res.answered ?? [];
  show('answered-title', answered.length > 0);
  $('answered-list').replaceChildren(...answered.map(answerItem));
  $('next-hint').textContent = COPY['next.hint'];
  $('next-btn').textContent = COPY['btn.next'];
  $('reveal-title').focus();

  if (voiceOn()) speakReveal(gen);
}

async function speakReveal(gen) {
  const lines = [
    $('summary-line'),
    ...$('missed-list').children,
    $('answered-list').querySelector('.selfrate-prompt'),
    $('next-hint')
  ].filter(Boolean).map(n => n.textContent);
  for (const line of lines) { if (gen !== S.gen) return; await speak(line); }
}

function answerItem(a) {
  const li = el('li');
  li.dataset.part = a.part;
  li.append(el('blockquote', a.answer ?? ''));
  const dims = el('ul', null, 'dims');
  const lines = dimLines(a.result);
  dimNames(a.result).forEach((name, i) => {
    const row = el('li', lines[i]);
    const items = rubricLines(a.result[name]);
    if (items.length) row.append(el('ul'));
    for (const t of items) row.lastChild.append(el('li', t));
    dims.append(row);
  });
  li.append(dims);
  li.append(el('p', COPY['selfrate.prompt'], 'selfrate-prompt'));
  const row = el('div', null, 'row');
  for (const [rating, label] of Object.entries(COPY['selfrate.options'])) {
    const b = el('button', label, 'secondary');
    b.type = 'button';
    b.dataset.rating = rating;
    b.setAttribute('aria-pressed', String(a.selfRating === rating));
    b.addEventListener('click', () => rate(a.part, rating, row));
    row.append(b);
  }
  li.append(row);
  return li;
}

// PD-7: a failed rating is shown and spoken under its row, with Try again; the
// pressed state only changes once the server has the rating.
async function rate(part, rating, row) {
  const li = row.closest('li[data-part]');
  try {
    await api.postSelfRating(S.attemptId, { part, rating });
  } catch (err) {
    console.warn('self-rating failed', err);
    rateError(li, () => rate(part, rating, row));
    return;
  }
  const hadFocus = li.querySelector('.rate-retry') === document.activeElement;
  li.querySelector('.rate-error')?.remove();
  li.querySelector('.rate-retry')?.remove();
  for (const b of row.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.rating === rating));
  if (hadFocus) row.querySelector(`button[data-rating="${rating}"]`)?.focus();
}

function rateError(li, retry) {
  let msg = li.querySelector('.rate-error');
  let btn = li.querySelector('.rate-retry');
  if (!msg) {
    msg = el('p', null, 'rate-error');
    msg.setAttribute('role', 'status');
    btn = el('button', COPY['btn.retry'], 'secondary rate-retry');
    btn.type = 'button';
    li.append(msg, btn);
  }
  btn.onclick = retry; // one handler: the latest rating is the one retried
  btn.focus();
  S.gen++; // ends the reveal read-out, so the next line doesn't cut the error off
  say(msg, COPY['err.rate']);
}

/* ---------- wiring ---------- */

$('stop-btn').addEventListener('click', e => onStop('button', e.timeStamp));
$('submit-btn').addEventListener('click', submitStop);
$('answer-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submitStop(); }
});
$('continue-btn').addEventListener('click', onContinue);
$('assist-btn').addEventListener('click', onAssist);
$('retry-btn').addEventListener('click', () => { show('net-error', false); retryAction?.(); });
$('skip-btn').addEventListener('click', onSkip);
$('next-btn').addEventListener('click', openPicker); // FR-058 Wave A: the picker; F1c-T10 retargets it
$('voice-toggle').addEventListener('change', () => { if (!voiceOn()) stopSpeaking(); });

const isTextField = t => t instanceof HTMLElement && (t.isContentEditable || /^(TEXTAREA|INPUT|SELECT)$/.test(t.tagName));
document.addEventListener('keydown', e => {
  if (e.key !== ' ' || e.repeat || S.phase !== 'narrating' || isTextField(e.target)) return;
  e.preventDefault();
  onStop('key', e.timeStamp);
});

loadPicker();
