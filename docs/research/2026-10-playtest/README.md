# Founder playtest research (2026-10-13)

The founder commissioned this research after playtesting the end-of-Wave-1 build (thread 0006). Agents wrote the reports and the lead saved them. Each report grades its sources (strong / medium / weak).

| Report | Question | Headline |
|---|---|---|
| [pmp-and-interview-prep.md](pmp-and-interview-prep.md) | When and how to move to PMP; is interview prep a fit? | PMP first, interview prep later (system design first). Write PMP content now and run a paper playtest; wire the pack into code right after F1b. Use a neutral name plus a PMI disclaimer. |
| [point-system.md](point-system.md) | How to improve the points | Make points explain themselves; weight reasoning more; lead with a mastery meter per competency; weekly goals instead of streaks. No leaderboards and no combo multipliers. A latent bug rates a zero-mistake run as the worst tier. |
| [voices.md](voices.md) | Voices that help learning; a voice picker | The robotic voice is mostly a bug: `pickVoice()` prefers old voices. Free fix: rank voices, add a picker (voice, rate, preview), speak one sentence per utterance. Next: Kokoro (Apache) pre-rendered on the server. Paid APIs only if a blind test favours them. |
| [name-ui-visuals-scroll-bug.md](name-ui-visuals-scroll-bug.md) | Name; UI that appeals to learners; visuals while talking; the scroll bug | Shortlist: Hold Up! · Call It · Not Quite. One focal line plus a step progress bar beats an avatar or scene art. Scroll bug: `scrollIntoView` ignores the sticky STOP button; fix with scroll-padding or a flex layout. |

The PM sorts each item into Wave 2, a post-F1a polish slice, F1b, F2 or later.
