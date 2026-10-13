<!-- Research commissioned by the founder on 2026-10-13 (thread 0006). Written by a research agent; saved by the lead. Not legal advice. -->

## Tester consent: research and recommendation (not legal advice)

**Repo context.** The tester sheet has one consent line in its "About you" table: "May we reuse your written answers, without your name, to test our automatic grader? ☐ yes ☐ no" (`/home/user/ai-learning-app/docs/research/2026-10-playtest/pmp-scenarios-draft/README.md`, around line 384). `/home/user/ai-learning-app/docs/foundation/data-and-evidence.md` §6 already promises local SQLite, export and delete, opaque learner IDs, and that explanation text goes only to the grading call. The conflict: ADR 0001 triggers block DELETE on `event`, and `result`/`context` JSON can hold free text. So "delete" can't be honoured today without a design change.

Source strength: **A** = primary or official, **B** = reputable secondary or law-firm summary, **C** = vendor blog or single source.

### 1. Practice
- **TestFlight.** The first build sent to external testers goes through Beta App Review. Apple requires a beta description and a feedback email. Up to 10,000 testers, and each build lasts 90 days (A: https://developer.apple.com/help/app-store-connect/test-a-beta-version/overview-of-testflight/). Whether a privacy-policy URL is mandatory for beta review isn't confirmed (C). This matters little for us because we are a PWA.
- **Google Play.** New personal developer accounts must run a closed test with at least 12 opted-in testers for 14 continuous days before production (A, quoted via B/C: https://www.choicely.com/blog/google-play-12-tester-rule). Not relevant unless we ship to Android.
- **Steam Playtest.** It is effectively public with no NDA. Valve points to release-override keys when you need NDAs (A: https://partner.steamgames.com/doc/features/playtest). Indie studios add NDAs through tools like FirstLook (C).
- **NDAs.** NDAs are common in game and enterprise betas. Usability testing usually skips them (OpenMRS drops them on purpose: B, https://openmrs.atlassian.net/wiki/x/mgebAQ). For a friends-and-network playtest an NDA adds friction and little protection. Skip it.
- **UX research forms.** I found no NN/g template page. The common base is usability.gov's public-domain "Consent & Recording Release Form – Adult": voluntary, research-only use of recordings, withdraw any time (A/B mirror: https://uni-weimar.de/kunst-und-gestaltung/wiki/IFD:UXTemplates/recordingReleaseForm). The UK DfE user-research guidance has editable consent templates (A: https://user-research.education.gov.uk/guidance/informed-consent-26/6).
- **Duolingo.** I found no published study-consent form. Its privacy policy covers "research" and audio/transcripts used for AI training by consent-through-use. Child speech data is excluded from product improvement (B/C: https://conductatlas.com/platform/duolingo/duolingo-privacy-policy/, https://privacy.commonsense.org/evaluation/duolingo). That is weak practice to copy. Big platforms bundle; academic and UX practice separates the consents.

### 2. Legal baselines
- **GDPR** (applies if any tester is in the EU or UK).
  - *Lawful basis.* Use **consent** for optional uses (eval-set reuse, voice recording). Use **contract or legitimate interest** for running the game itself.
  - *Minimisation.* Collect no names. Tester codes are pseudonymous data, which is still personal data.
  - *Art. 17 erasure versus append-only storage.* The EDPB's 2025 draft blockchain guidelines say immutability "should not dictate retention periods". Systems should be designed so that, on an erasure request, data can be "rendered anonymous… by deleting any off-chain data or keys". The EDPB also warns that encryption ages and that unsalted hashes are insufficient (A, draft: https://cms.law/en/svk/legal-updates/edpb-issues-draft-blockchain-guidelines-part-2, https://heise.de/-10354850).
  - *Event-sourcing practice.* Event-sourcing teams use (a) **crypto-shredding**: per-user keys, delete the key; or (b) **a "forgettable payload"**: PII lives in a deletable side table and events hold only references (B, well-established community pattern). Art. 89 research exemptions exist, but don't rely on them.
- **CCPA/CPRA.** It applies only above $26.625M revenue, or at 100k+ California consumers, or when 50%+ of revenue comes from selling data (A: https://cppa.ca.gov/announcements/2024/20241217.html). We are almost certainly exempt. Honour deletion anyway.
- **Voice as biometric data.** BIPA lists "voiceprint" but doesn't define it. A 2017 Illinois AG opinion separates a recording from a speaker-identifying measurement. Pending suits (Microsoft Teams transcription, Otter, Lowe's) argue the line is speaker recognition, not transcription. No ruling settles it (B: https://www.americanbar.org/groups/litigation/resources/newsletters/class-actions-derivative-suits/voiceprints-ai-bipa-new-trends-biometric-privacy-litigation/). Texas CUBI and Washington's RCW 19.375 (plus WA's My Health My Data Act) cover similar ground (B, from my knowledge, not fetched).
  - **Implication:** transcribe in the browser where possible, don't keep raw audio by default, never do speaker identification, and get explicit opt-in before keeping audio.
- **Children and COPPA.** COPPA applies to under-13s and needs verifiable parental consent. Restrict both the playtest and the beta to **18+**. That also avoids GDPR Art. 8 age-of-consent differences.
- **Anthropic API.**
  - **Training:** Anthropic's Commercial Terms say it may not train models on Customer Content (inputs and outputs) from the services (A: https://www.anthropic.com/legal/commercial-terms). Anthropic's API data-retention page says "retained data is never used for model training without your express permission" (A, fetched: https://platform.claude.com/docs/en/manage-claude/api-and-data-retention).
  - **Retention:** the standard commercial retention is about 30 days (B; Anthropic's own page https://privacy.claude.com/en/articles/7996866 wasn't reachable from the sandbox). Zero Data Retention (ZDR) needs Anthropic's approval. With structured outputs, only the schema is cached, for up to 24 hours. Content flagged by trust and safety may be kept up to 2 years even under ZDR (A, same docs page).
  - **Unconfirmed:** a June 2026 "covered models" 30-day retention change and a "Development Partner Mode" training opt-in are reported only by secondary sources (C: https://www.theregister.com/a/5293789). Check before launch, and never opt into training.

### 3. Research ethics
- The Common Rule binds federally funded US research. A private product team isn't legally bound. But if results get published or partner with a university, IRB review becomes expected.
- The Facebook emotional-contagion study (2014): PNAS issued an Editorial Expression of Concern because users weren't told and couldn't opt out. The editor noted Facebook was "under no obligation" to follow the Common Rule (A/B: https://retractionwatch.com/2014/07/03/rapid-mood-swing-pnas-issues-expression-of-concern-for-controversial-facebook-study/).
- The counter-view is Meyer et al.'s "A/B illusion". Across 16 experiments (n=5,873), people judged A/B tests less acceptable than imposing either option untested (A: https://pmc.ncbi.nlm.nih.gov/articles/PMC6561206).
- Our trained vs. held-out split is low-risk: everything is eventually trained through the crossover. But it **delays practice on some skills**, so disclose it.
- Standard elements to include: purpose, procedures, risks (low), voluntariness, withdrawal without penalty, data use and retention, and a contact.

### 4. Recommendation

**Paper playtest one-pager (draft):**
> **About this playtest.** We're testing an early learning game. You'll read 10 short project stories, mark where the assistant makes a mistake, and explain why. It takes about 40 minutes. This is a test of the game, not of you.
> **What we collect.** Your written answers, your confidence ticks, your PM-experience band and times. We use a tester code, not your name. Don't write your name or anyone's personal details in your answers.
> **How we use it.** We read and score your answers by hand. We may type them into our app and send them to Anthropic's Claude to see whether our automatic grader agrees. Anthropic processes them for us and, under its commercial terms, doesn't use them to train its models.
> **Optional (tick each):**
> ☐ You may keep my anonymised answers to test and improve our automatic grader.
> ☐ You may quote short anonymised excerpts in internal notes.
> ☐ You may contact me about the app beta: ________
> **Your choices.** Taking part is voluntary. You can skip any case, stop at any time, or later ask us to delete your answers by quoting your tester code to [email]. We'll delete them within 30 days, including from any grader test set. We keep paper sheets until [date] and then shred them.
> **You're 18 or older and agree to take part:** ☐ yes  Tester code ____  Date ____

Split the sheet's existing single yes/no into the separate ticks above. Keep the code-to-contact mapping on a separate sheet held by the founder only.

**App beta first-run screen (spoken and displayed identically, per invariant 9):**
> "Before we start: this is a beta. We save what you say or type, and how you do, so the game can adapt to you and so we can check that it teaches. Your explanations are sent to Anthropic's Claude for grading. Anthropic doesn't train on them. We don't use your name in any of it. Some skills are saved for later so we can measure what the app taught you; you'll get to practise them all. You can export or delete your data at any time in Settings. Say 'I agree' or tap Agree. You must be 18 or over."

Then show separate opt-in toggles, all off by default:
- "Keep audio recordings to improve speech recognition." Default off: transcribe, then discard the audio.
- "Let us reuse my anonymised answers to test the grader."

Settings should offer:
- **Voice on/off**, with text always available.
- **Export my data** (JSON).
- **Delete my data**, which runs a key shred immediately and shows a confirmation.
- Log `consent-given` / `consent-withdrawn` events that record the consent text version.

**Storage (needs an ADR from principal-architect, since it touches ADR 0001):**
1. `actor` stays an opaque random ID, never derived from an email.
2. Put identity (email, name, invite code) in a separate `identity` table that is **not** under the no-delete triggers.
3. Encrypt free text (explanations, transcripts, any audio) with a **per-learner key** in a deletable `learner_key` table. Erasure deletes the identity row and the key. Events stay append-only, but their text becomes unreadable. Non-text fields (verdicts, scores, timings) remain, unlinked from the person. That is close to anonymous, but a residual-risk note belongs in the ADR (EDPB caveat).
4. Mastery projections rebuild as "unknown learner" or drop.
5. Eval-set copies (`evals/sets/`, git) are the hard case: git history makes erasure hard. Store only consented rows keyed by tester code, keep a manifest so a withdrawal can be purged, and never commit raw tester text before consent is checked.

**What to tell testers about AI:**
- Name Anthropic as the processor.
- State: no training (commercial terms); about 30 days' retention; up to 2 years if flagged for safety review.
- Only the explanation text and the scenario go to the API, never names. This matches §6 of data-and-evidence.md.
- When AI is unavailable, grading falls back to a simpler method, and the app says so.
- Apply for ZDR before a wider beta if possible.

**Sources I could not verify directly:** Anthropic's privacy.claude.com pages (DNS blocked from the sandbox), an NN/g template page, and the full texts of Texas CUBI and Washington's law.
