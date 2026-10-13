<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by a research agent; saved by the lead. -->

# Report: names, learner UI, visuals during narration, and the auto-scroll bug

I didn't edit the repo. I read `web/index.html`, `web/styles.css` and `web/app.js`. Each source is graded **Strong** (peer-reviewed meta-analysis or primary handbook), **Medium** (single studies or official vendor pages) or **Weak** (blogs, third-party summaries or search snippets). Several sources were read only as search summaries, not full text.

## 1. Name

The name collision checks are a quick web search only. This is not trademark or legal advice. Before committing, search USPTO/EUIPO and the App Store and Play Store directly.

| # | Name | Meaning / what it signals | Quick collision check |
|---|---|---|---|
| 1 | **Hold Up!** | What you say to stop someone mid-action. Matches the voice command; casual and urgent. | No learning app with this exact name found. "Hold" is a focus/anti-phone app for students, a near neighbour. Low–medium risk. |
| 2 | **Call It** | "Call it out." Decisive and sporty. | Nothing found for "Call It Out". Common phrase. Low risk, unverified. |
| 3 | **Not Quite** | A gentle "that's wrong". Friendly rather than harsh. | "Not Quite Hangman" word game on the App Store. Low risk. |
| 4 | **Objection!** | Courtroom energy; you argue a reasoned case. | "Objection Academy" is a law-training app. "Objection!" is also strongly linked to Capcom's Ace Attorney. Medium risk. |
| 5 | **Redline** | Marking up errors (editing, engineering). Professional tone. | Klett "Red Line" vocab trainer, plus many non-education brands. Medium risk; hard to own in search. |
| 6 | **Gotcha** | Playful "caught you". | No learning app found, but the word is generic and widely used. Hard to own. |
| 7 | **Catch It** | The core verb. | "Catch It English" exists on the App Store. Medium risk. |
| 8 | **Spot It** | Spot the mistake. | **Strong collision:** Asmodee's *Spot It!* card game (Dobble). Avoid. |
| 9 | **Second Look** | Careful review. | **Collision:** University of Michigan's SecondLook medical-education apps. Avoid. |
| 10 | **Flag It** | Flag the problem. | Results are flooded by country-flag quiz apps, so discoverability is poor. |
| 11 | **Teachback** (broader) | The teach-back method: you learn by explaining. | **Collision:** "TeachBack" (indie AI learning app) and CanopyTeachback. Avoid. |
| 12 | **Stop the Apprentice** (current) | Already works beyond trades, since every field has apprentices. Long, though. | Not checked. Keep as a mode or tagline. |

**Shortlist:**
1. **Hold Up!** It is the spoken STOP command itself, works for any subject, is short and game-like, and had no exact hit.
2. **Call It.** It is active and confident, frames the learner as the expert, and is short enough for voice.
3. **Not Quite.** It has a warm tone suited to exam and interview prep, which can feel stressful.

**Competitor to know about:** **Lathoa** is a math app for ages 10–14. Its AI character "Errol" solves problems with a deliberate mistake, and kids spot and explain it, earning "detective ranks". The concept overlaps closely; the differences are voice-first, adults and many subjects. (Weak: Show HN repost.)

## 2. UI that appeals to learners

**Evidence (strong to medium)**
- **Coherence:** removing extraneous material helped in 23 of 23 tests (median d≈0.86). **Signaling:** cueing what matters helped in 24 of 28 (d≈0.41). Both from Mayer's Cambridge Handbook chapter (Strong). A signaling meta-analysis found d=.38 across 29 studies (Strong).
- **Seductive details:** decorative or interesting-but-irrelevant content hurts learning. Rey 2012 found medium negative effects; Sundararajan & Adesope 2020 found g=−0.33 over 58 studies. Visual seductive details hurt most (Strong; read via summaries).
- **Redundancy:** narration plus identical on-screen text plus a *graphic* hurts learning (16 of 16 tests, d≈0.86) (Strong). The boundary matters here. The effect is shown with pictures or animation. Brief labels and slightly reworded text can help (Yue, Bjork & Bjork 2013, Medium). No source tested narration plus text with no picture. That is this app's case, and here the learner must refer back to the exact wording, so invariant 9 is defensible. The risk would come from adding a third channel, such as a busy scene, on top.
- **Dark vs light:** positive polarity (dark text on light) gave better acuity and proofreading for normal-vision users, and the gap grew as text got smaller. There was no difference in fatigue (Piepenbrock et al., via Nielsen Norman Group; Medium). Users don't *perceive* the difference.
- **Progress:** the goal-gradient effect means effort speeds up as a goal gets closer. Endowed ("head-start") progress raised completion (Kivetz et al. 2006; Strong for the effect, but from loyalty programs, not learning apps).

**Practice and opinion (medium to weak)**
- **Duolingo:** official guide. Rounded shapes everywhere ("pointy shapes are off-brand"), a minimal illustration style and a mostly rounded-rectangle shape language (Medium). The custom rounded font ("Feather") is a third-party claim (Weak).
- **Khan Academy:** rebuilt its Wonder Blocks colour system in 2025 with semantic tokens, motivated by misuse such as icon colours used for text (Medium; official blog).
- **Brilliant:** hands-on interaction first, plus Koji, a 2D tutor character built in Rive that reacts to lesson state by waving, nodding and reacting to struggle versus ease (Medium; vendor blog).
- **Speak:** speaking-first loop with instant speech feedback. I found no official design write-up (Weak).

**Recommendations for this app**
1. **One focal line.** Show the current line large and high-contrast, and dim and shrink earlier lines (signaling and coherence). Today all lines look the same apart from a 4px border.
2. **Keep hazard stripes to the brand edge and the STOP control.** Don't add decoration inside the transcript (seductive details).
3. **Shrink STOP into a bottom dock.** A ~120–160px button in a reserved bar is still a large target. Today's 260px circle plus rings takes ~300px of a phone screen.
4. **Offer light mode** through `prefers-color-scheme` with a toggle, and default to the OS setting. Dark can stay the brand look. Evidence slightly favours light for reading.
5. **Readability:** 18–20px text, 45–75 characters per line, line-height 1.5, contrast ≥4.5:1 (WCAG). Never use colour alone for verdicts; add an icon and a word (WCAG 1.4.1).
6. **Motion only for meaning.** Pulse the speaking line; give a short burst or score tick on a correct catch. No idle animation during narration. Respect `prefers-reduced-motion`.
7. **Step progress plus a catch counter** ("Step 5/12 · 2 caught") as a slim segmented bar (goal gradient). Optionally start the bar with one segment filled (endowed progress).
8. **Short sessions** of 3–5 minutes per job, with an immediate "one more" button to support focus. This is opinion, consistent with Duolingo's bite-size model.
9. **Rounded, friendly shapes** for panels and feedback, and keep the tone encouraging on a miss. This is an opinion drawn from Duolingo and Khan practice.

## 3. Visuals while the apprentice talks

**Research**
- **Pedagogical agents:** there is a small overall benefit. Schroeder, Adesope & Gilbert 2013 found a small but significant effect across 43 studies. Castro-Alonso et al. 2021 found g=0.20 across 32 effects, with 2D agents (g=0.38) beating 3D (0.11). Most human-like features (gesture, motion, voice) did *not* change the effect (Strong). The authors warn that some sub-groups had little statistical power.
- **Image principle:** showing the speaker's image does *not* reliably help. Half of 14 tests were null or negative (median d≈0.20). **Embodiment principle:** if an agent is shown, human-like gesture and eye contact help more than a static figure (Strong; Mayer handbook).
- **Persona effect:** the affective benefit of an agent may not need its image at all, since voice carries much of it (Schroeder & Adesope review; Medium).
- **Split attention:** keep related info in one place and in sync. A face or scene placed away from the text pulls the eyes away from it.
- **Karaoke highlighting:** studies are small and in special populations (aphasia, dyslexia). Learners *prefer* highlighting and read along more easily, but comprehension gains came from the audio, not the highlight (Weak–Medium).

**Options**
- **Captions:** the transcript already is the captions, which meets invariant 9.
- **Line highlight plus speaking indicator:** cheap and robust. Uses the signaling principle.
- **Word-level karaoke:** depends on the Web Speech API's word `boundary` events, which I believe are unreliable across browsers and voices. That is my claim, not something I sourced; test it before relying on it. Line-level highlighting needs no such events.
- **Step progress timeline:** cheap, helps focus and motivation.
- **Waveform:** looks nice but is decorative. A simple pulsing dot on the current line is enough.
- **Avatar:** small effect. Worth it only as 2D, minimal and *reactive* (reacting at feedback moments), Koji-style. It adds an art pipeline.
- **Scene illustration per step:** highest cost. Every pack needs art, which strains the subject-agnostic engine. There is a seductive-detail and redundancy risk. A picture could also **give away or contradict the planted mistake**, which works against the spirit of invariant 2.

**Build first:**
1. Current-line highlight with a speaking pulse, and earlier lines dimmed.
2. A step progress timeline with a catch counter.
3. An optional 2D reactive mascot that appears only on STOP and feedback, not during narration. Defer scene art.

## 4. Bug: transcript doesn't auto-scroll, so new lines sit under STOP

**Cause.** In `web/app.js:105`, `appendLine` calls `li.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`. `block: 'nearest'` scrolls only until the line's bottom edge reaches the bottom of the viewport. But `.stop` in `web/styles.css` is `position: sticky; bottom: 16px`, sized `min(260px, 70vw)`, with a `0 0 0 18px` ring. Once the transcript is taller than the screen, that button stays pinned over the bottom ~300px of the viewport. `scrollIntoView` doesn't account for sticky or fixed overlays, so the browser counts the new line as visible while the button covers it. Two things make it worse:
- The fixed `.panel` (explain and feedback) covers even more of the screen.
- Smooth scrolls that start while the previous one is still running can stop short.

**Fix options, smallest first:**
1. **Reserve the space with CSS.** Define `--stop-zone: calc(min(260px, 70vw) + 18px + 16px + 24px)`. Then use `html { scroll-padding-bottom: var(--stop-zone); }` (scrollIntoView respects scroll-padding) or `.transcript li { scroll-margin-bottom: var(--stop-zone); }`. Keep `block: 'nearest'`, or use `'end'`.
2. **Or scroll to the end** after appending: `window.scrollTo({ top: document.documentElement.scrollHeight, behavior })`. Because the sticky button sits in normal flow after the transcript, at maximum scroll it rests below the last line.
3. **Better structure, which fits recommendation 3.** Make the play screen a full-height flex column: header, a transcript with `flex: 1; overflow-y: auto`, then a STOP dock that holds its own space. Then set `transcript.scrollTop = transcript.scrollHeight`. The button can no longer cover content.

Also:
- Use `behavior: 'auto'` when `prefers-reduced-motion` is set.
- Add a regression check at phone width (≈375px), in both voice and text mode.

## Sources
- Mayer, coherence/signaling/redundancy chapter (Strong): https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles/C98AB3A6CE760DD63C048936EA0B3B44
- Signaling meta-analysis (Strong): https://rex.libraries.wsu.edu/esploro/outputs/journalArticle/A-meta-analysis-of-signaling-principle-in/99900601052901842
- Mayer, social-cue principles (image, embodiment) (Strong): https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-based-on-social-cues-in-multimedia-learning/093C1CDE75CF486DACD4CABC325ABE47 ; Mayer 2020 handout: https://ugc.futurelearn.com/uploads/files/7d/d6/7dd6188d-c343-4311-b064-ac98d2c95abc/Multimedia_Principles._R._E._Mayer__2020.pdf
- Redundancy with slight discrepancy, Yue/Bjork (Medium): https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2016/07/YueBjorkBjork2013_redundancy.pdf
- Seductive details overview (Weak–Medium): https://en.wikipedia.org/wiki/Seductive_details ; https://www.learningscientists.org/blog/2019/6/20-1
- Castro-Alonso et al. 2021 (Strong): https://repub.eur.nl/pub/133141 ; summary: https://www.qic-wd.org/sites/default/files/Umbrella%20Summary%20-%20Pedagogical%20Agents%20040521.pdf
- Schroeder & Adesope (Medium–Strong): https://karlkapp.com/abstracts-of-three-studies-related-to-pedagogical-agents/
- Dark mode (Medium): https://www.nngroup.com/articles/dark-mode/
- Highlighting with TTS (Weak–Medium): https://dsc.duq.edu/faculty/63 ; https://www.atia.org/wp-content/uploads/2020/06/ATOB-V14-A2-Keelor_etal.pdf ; https://online-journals.org/index.php/i-jet/article/view/8736
- Goal gradient (Strong primary; secondary page): https://business.columbia.edu/insights/chazen-global-insights/goal-gradient-hypothesis-resurrected-purchase-acceleration ; https://lawsofux.com/goal-gradient-effect/
- Duolingo (Medium): https://design.duolingo.com/illustration ; https://blog.duolingo.com/shape-language-duolingos-art-style/
- Khan Academy (Medium): https://blog.khanacademy.org/how-we-rebuilt-khan-academys-color-system-from-the-ground-up
- Brilliant Koji (Medium): https://rive.app/blog/brilliant-builds-its-math-and-coding-tutor-character-with-rive
- Speak (Weak): https://screensdesign.com/showcase/speak-learn-spanish-french
- scroll-padding and sticky elements (Medium): https://webreference.com/css/properties/scroll-padding-bottom/ ; https://lists.w3.org/Archives/Public/public-css-archive/2022Oct/0929.html
- Name checks: Spot It!/Asmodee https://toybook.com/asmodee-acquires-the-rights-to-spot-it-game ; SecondLook https://secondlook.med.umich.edu/ ; Objection Academy https://apps.apple.com/app/id6739860697 ; Not Quite Hangman https://apps.apple.com/app/id1538063923 ; Catch It English https://apps.apple.com/us/app/%EC%BA%90%EC%B9%98%EC%9E%87-%EC%9E%89%EA%B8%80%EB%A6%AC%EC%8B%9C-%EC%98%81%EC%96%B4%ED%95%98%EB%A9%B4-%EC%BA%90%EC%8B%9C%EA%B0%80-%EC%8C%93%EC%9D%B4%EB%8A%94-%EC%98%81%EC%96%B4%ED%9A%8C%ED%99%94-%EC%95%B1/id881322806 ; TeachBack https://www.indiehackers.com/product/teachback ; Hold https://felixonline.co.uk/articles/2018-11-19-too-distracted-by-your-phone-to-study-the-hold-app-is-here-to-help-you-out/ ; Red Line https://apkcombo.com/red-line-vokabeltraining/de.klett.trainer.redline/ ; Lathoa https://zeli.app/story/49909648
