# Demo run-of-show (3 minutes)

**Setup:** Chrome, full screen, volume up. Job: **Electrical: replace a receptacle**. **Use cached scenario: ON**, so it's the same job every time and doesn't depend on the network.

| Time | Who | What happens |
|---|---|---|
| 0:00 | Presenter | **Hook.** "Apprentices learn judgment by watching a journeyman catch mistakes. But you can't let a rookie almost electrocute themselves just so someone can practice catching it." |
| 0:20 | Presenter | **The flip.** "So we flipped it. The AI is the apprentice and you're the supervisor. Danny talks through the job. Somewhere in there he messes up. You have one button." Point at STOP. |
| 0:35 | Judge | Hand a judge the laptop, or have them say "stop" while you press **Space**. Press **Start the job**. |
| 0:45 | Danny (AI) | Steps 1–2 play: the outlet sparks, he flips the breaker. |
| ~0:55 | Judge | **Step 3:** "Not gonna bother with the tester." The room should react. **STOP.** The judge answers out loud ("he didn't test it, it could still be live"). Submit. |
| 1:10 | AI | Feedback is read aloud: "Good catch" and why, **+300**. |
| 1:20 | Presenter | Continue. On **step 5 (the non-GFCI receptacle next to the sink)**, *don't* stop. "Let's see what happens if we miss one." |
| 1:50 | AI | Job ends and the results screen shows **"What happened next"**: the homeowner gets shocked months later. Pause and let it land. |
| 2:05 | Presenter | **Why it's real:** Claude writes a fresh job with hidden mistakes for any trade and grades plain-language answers. Show the dropdown: brazing, brake job. "A new trade is a prompt, not a codebase." |
| 2:25 | Presenter | **Who pays:** apprenticeship programs, contractors running safety training, and insurers who price jobsite incidents. "Judgment practice that used to need a jobsite and a near-miss." |
| 2:45 | Presenter | **Close:** "Stop the Apprentice. Catch it here, so nobody has to catch it on the job." |

## If something breaks

| Problem | Do this |
|---|---|
| Mic doesn't pick up the judge | Type their answer into the box. Typing always works. |
| No sound | Uncheck **Read aloud**. Lines appear as text at reading speed. |
| Wifi or API is down | Already covered: cached scenario plus keyword grading in the browser. Keep going. |
| Live grading is slow (over 5 s) | Say "the journeyman's thinking…" and wait. If it happens in rehearsal, set `GRADE_EFFORT=low` (the default) or restart with `MOCK=1`. |
| Judge stops on the wrong step | That's fine. It's a false alarm (−75), and the explanation of why that step was fine is part of the demo. |
| Laptop dies | Second laptop, already open at the same URL. |

## Pre-demo checklist (T−10 min)

- [ ] `npm test` passes on the demo branch
- [ ] Server running; badge shows **LIVE** (or **MOCK** if that's the plan)
- [ ] Chrome mic permission granted for the page (click 🎤 once to trigger the prompt)
- [ ] Volume tested in the room
- [ ] Cached scenario ON, electrical job selected
- [ ] Second laptop open on the deployed URL
- [ ] Run through it once start to finish, then reload the page
