// Every string the practice page shows or speaks, keyed by the spec's copy-table
// ids (docs/specs/F1c-practice-engine/spec.md "Spoken copy"). {x} slots are
// filled once by state.js `fill`; pack text is never re-scanned for slots.
// `sum.line` keeps one id: {s} is '' when f = 1 and 's' otherwise.

export const COPY = Object.freeze({
  'picker.empty': 'No practice tracks are loaded.',
  'intro.catch': 'Listen for statements that are wrong. Say "stop", press Stop or press Space when you hear one. Some sets have no errors.',
  'prompt.stop': "What's wrong, and what should it say?",
  'fb.hit.met': 'Good catch. {whyWrong}',
  'fb.hit.partial': "You caught it. Here's the full picture: {whyWrong}",
  'fb.hit.not_met': "Right statement to stop on. Here's why it's wrong: {whyWrong}",
  'fb.hit.uncertain': "Right statement to stop on. I can't score your answer reliably, so it's flagged for review. {whyWrong}",
  'fb.late.prefix': 'That was the previous statement.',
  'fb.false': "That statement is accurate. Let's carry on.",
  'say.corrected': 'Corrected: {correctedText}',
  'btn.assist': 'Show the reference (counts as assisted)',
  'assist.spoken': 'The reference is on screen. Answers from here on count as assisted.',
  'end.catch': "That's the end of the set.",
  'sum.line': 'Caught {hits} of {planted}. Missed {misses}. Stopped on {f} accurate statement{s}.',
  'end.clean': "This set had no errors, and you didn't stop on any accurate statement. Well judged.",
  'missed.item': 'Missed: {text} {whyWrong} Corrected: {correctedText}',
  'status.met': 'Covered',
  'status.partial': 'Partly covered',
  'status.not_met': 'Not covered',
  'status.uncertain': 'Uncertain: flagged for review',
  'dim.explanation': 'Explanation',
  'dim.correction': 'Correction',
  'selfrate.prompt': 'Compare your answer with the reference. How did you do?',
  'selfrate.options': Object.freeze({ had_it: 'I had it', partly: 'Partly', missed_it: 'I missed it' }),
  'next.hint': 'Say "next" or press Next for the next exercise.',
  'btn.next': 'Next',
  'err.net': "Couldn't reach the server. Your answer is still here. Try again, or skip and this stop won't be scored.",
  'src.unverified': '(not yet verified)',
  'missed.notGraded': 'Not scored, you skipped this stop: {text} {whyWrong} Corrected: {correctedText}',
  'err.rate': "Couldn't save your rating. Try again.",
  'btn.retry': 'Try again',
  'err.rejected': 'The server can\'t continue this exercise, and trying again won\'t help. Say "back" or press Back to exercises.',
  'btn.picker': 'Back to exercises'
});
