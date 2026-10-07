// Game loop and UI — owned by the Stage.
//
// Phases: setup -> playing -> explaining -> grading -> feedback -> playing ... -> done

import { fetchHealth, fetchTrades, fetchScenario, gradeStop } from './api.js';
import { speak, stopSpeaking, wait, canListen, listen } from './speech.js';
import { resolveStop, scoreStop, scoreRun } from '/shared/scoring.js';

const STEP_GAP_MS = 900; // pause after each line so the learner has time to react

const $ = id => document.getElementById(id);

const game = {
  phase: 'setup',
  scenario: null,
  stepIndex: -1,
  events: [],
  caught: new Set(),
  pendingStop: null,
  runToken: 0, // bumping this cancels the running playback loop
  voice: true,
  mic: null
};

const VERDICT_LABEL = {
  correct: 'Good catch!',
  partial: 'Close…',
  wrong: 'Right moment, wrong reason',
  false_alarm: 'False alarm'
};

// ---------- setup ----------

async function init() {
  try {
    const { mode } = await fetchHealth();
    $('mode-badge').textContent = mode;
    $('mode-badge').classList.toggle('live', mode === 'live');
    const trades = await fetchTrades();
    $('trade-select').innerHTML = trades.map(t => `<option value="${t.id}">${t.label}</option>`).join('');
  } catch (err) {
    $('setup-msg').textContent = `Can't reach the server: ${err.message}`;
  }
  if (!canListen) {
    $('mic-btn').hidden = true;
    $('mic-msg').textContent = 'Voice input needs Chrome or Edge. Type your answer instead.';
  }
}

async function startJob() {
  $('start-btn').disabled = true;
  $('setup-msg').textContent = 'The apprentice is getting their tools…';
  try {
    const scenario = await fetchScenario($('trade-select').value, { cached: $('cached-toggle').checked });
    Object.assign(game, { scenario, stepIndex: -1, events: [], caught: new Set(), pendingStop: null });
    game.voice = $('voice-toggle').checked;
    $('job-title').textContent = scenario.title;
    $('job-setting').textContent = scenario.setting;
    $('transcript').innerHTML = '';
    updateScore();
    show('play-screen');
    game.phase = 'playing';
    play(0);
  } catch (err) {
    $('setup-msg').textContent = `Couldn't load the job: ${err.message}`;
  } finally {
    $('start-btn').disabled = false;
  }
}

// ---------- playback ----------

async function play(fromIndex) {
  const token = ++game.runToken;
  const { steps } = game.scenario;
  for (let i = fromIndex; i < steps.length; i++) {
    game.stepIndex = i;
    appendLine(steps[i]);
    await speak(steps[i].line, { enabled: game.voice });
    if (token !== game.runToken) return;
    await wait(STEP_GAP_MS);
    if (token !== game.runToken) return;
  }
  finish();
}

function appendLine(step) {
  document.querySelectorAll('#transcript li.current').forEach(li => li.classList.remove('current'));
  const li = document.createElement('li');
  li.className = 'current';
  li.dataset.stepId = step.id;
  li.innerHTML = `<span class="who">${escapeHtml(game.scenario.apprentice)}</span>${escapeHtml(step.line)}`;
  $('transcript').appendChild(li);
  li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- STOP ----------

function onStop() {
  if (game.phase !== 'playing') return;
  game.runToken++;
  stopSpeaking();
  game.phase = 'explaining';
  game.pendingStop = {
    stepIndex: game.stepIndex,
    target: resolveStop(game.scenario, game.stepIndex, game.caught)
  };
  $('stop-btn').disabled = true;
  $('explain-input').value = '';
  $('explain-panel').hidden = false;
  $('explain-input').focus();
}

function toggleMic() {
  if (game.mic) {
    game.mic.stop();
    return;
  }
  $('mic-btn').textContent = '■ Done talking';
  game.mic = listen({ onInterim: text => { $('explain-input').value = text; } });
  game.mic.result
    .then(text => { if (text) $('explain-input').value = text; })
    .catch(err => { $('mic-msg').textContent = `Mic error: ${err}. Type your answer instead.`; })
    .finally(() => {
      game.mic = null;
      $('mic-btn').textContent = '🎤 Talk';
    });
}

async function submitExplanation() {
  if (game.phase !== 'explaining') return;
  game.mic?.stop();
  game.phase = 'grading';
  $('submit-btn').disabled = true;
  $('submit-btn').textContent = 'Grading…';

  const { scenario } = game;
  const { stepIndex, target } = game.pendingStop;
  const step = scenario.steps[stepIndex];
  const errorStep = target ? scenario.steps.find(s => s.id === target.errorStepId) : null;

  const result = await gradeStop({
    scenario,
    stepId: step.id,
    errorStepId: target?.errorStepId ?? null,
    explanation: $('explain-input').value.trim()
  });

  const isCatch = Boolean(target) && result.verdict !== 'false_alarm';
  const points = scoreStop({
    severity: isCatch ? errorStep.error.severity : null,
    stepsLate: target?.stepsLate ?? 0,
    verdict: result.verdict,
    reasoningScore: result.reasoningScore
  });

  if (isCatch) {
    game.caught.add(target.errorStepId);
    game.events.push({ type: 'catch', stepId: step.id, errorStepId: target.errorStepId, stepsLate: target.stepsLate, verdict: result.verdict, reasoningScore: result.reasoningScore, points });
  } else {
    game.events.push({ type: 'false_alarm', stepId: step.id, points });
  }
  markLine(isCatch ? target.errorStepId : step.id, isCatch ? 'caught' : 'false-alarm');
  updateScore();

  $('submit-btn').disabled = false;
  $('submit-btn').textContent = 'Submit';
  $('explain-panel').hidden = true;
  showFeedback(result, points, isCatch ? errorStep.error : null);
}

function showFeedback(result, points, mistake) {
  game.phase = 'feedback';
  $('feedback-verdict').textContent = VERDICT_LABEL[result.verdict] ?? result.verdict;
  $('feedback-verdict').className = `verdict ${result.verdict}`;
  const fix = mistake && result.verdict !== 'correct' ? ` ${mistake.correctAction}` : '';
  $('feedback-text').textContent = result.feedback + fix;
  $('feedback-points').textContent = `${points >= 0 ? '+' : ''}${points} points`;
  $('feedback-panel').hidden = false;
  $('continue-btn').focus();
  speak(result.feedback, { enabled: game.voice });
}

function resumeJob() {
  if (game.phase !== 'feedback') return;
  stopSpeaking();
  $('feedback-panel').hidden = true;
  $('stop-btn').disabled = false;
  game.phase = 'playing';
  play(game.stepIndex + 1);
}

// ---------- results ----------

function finish() {
  game.phase = 'done';
  const r = scoreRun(game.scenario, game.events);
  $('result-rating').textContent = r.rating;
  $('result-total').textContent = r.total;
  $('result-max').textContent = r.maxPossible;
  $('result-summary').textContent =
    `Caught ${r.caughtCount} of ${r.mistakeCount} mistakes · ${r.falseAlarms} false alarm${r.falseAlarms === 1 ? '' : 's'}`;
  $('missed-heading').hidden = r.missed.length === 0;
  $('missed-list').innerHTML = r.missed.map(m => `
    <li class="${m.severity}">
      <span class="sev">${m.severity} · missed · ${m.points} pts</span>
      <p><b>${escapeHtml(m.summary)}.</b> ${escapeHtml(m.consequence)}</p>
      <p class="muted">Should have: ${escapeHtml(m.correctAction)}</p>
    </li>`).join('');
  $('score').textContent = r.total;
  show('results-screen');

  const worst = r.missed.find(m => m.severity === 'critical') ?? r.missed[0];
  speak(worst ? `Here's what happened next. ${worst.consequence}` : 'Clean job. Nobody got hurt.', { enabled: game.voice });
}

// ---------- helpers ----------

function show(screenId) {
  for (const id of ['setup-screen', 'play-screen', 'results-screen']) $(id).hidden = id !== screenId;
  $('explain-panel').hidden = true;
  $('feedback-panel').hidden = true;
  $('stop-btn').disabled = false;
}

function markLine(stepId, cls) {
  document.querySelector(`#transcript li[data-step-id="${stepId}"]`)?.classList.add(cls);
}

function updateScore() {
  $('score').textContent = game.events.reduce((sum, e) => sum + e.points, 0);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ---------- wiring ----------

$('start-btn').addEventListener('click', startJob);
$('stop-btn').addEventListener('click', onStop);
$('mic-btn').addEventListener('click', toggleMic);
$('submit-btn').addEventListener('click', submitExplanation);
$('continue-btn').addEventListener('click', resumeJob);
$('again-btn').addEventListener('click', () => { stopSpeaking(); game.phase = 'setup'; show('setup-screen'); });
$('explain-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitExplanation(); }
});
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && game.phase === 'playing') { e.preventDefault(); onStop(); }
});

init();
