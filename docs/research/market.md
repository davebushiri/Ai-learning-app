# Market research and strategy

*Research workstream 3 of 4, October 2026. Many prices come from third-party trackers; confirm them on official pages before using them in a pitch.*

## Summary

- **The mechanic has research support, and nobody owns it.**
  - Erroneous examples improve delayed posttests, even though learners like them less ([McLaren et al.](https://par.nsf.gov/servlets/purl/10155531); [Richey et al. 2019](https://mail.editlib.org/p//209945)).
  - Teachers run "spot the error" exercises on AI output by hand ([Faculty Focus](https://www.facultyfocus.com/articles/teaching-with-technology-articles/when-ai-gets-it-wrong-a-pedagogical-approach/); [NSTA](https://www.nsta.org/blog/what-if-ai-gets-it-wrong-teaching-students-detect-errors-and-misleading-models)).
  - No product is built around "the AI deliberately errs and you catch it."
- **It's easy to copy with one prompt.** The defensible parts are curated, verified mistake libraries; rubric grading; consequences; and a learner model built on the *kinds* of mistakes you miss.
- **First wedge: PMP situational-judgment practice ("Stop the PM"), sold as a supplement to existing prep.** The July 9, 2026 outline change has created an opening. Trades is the stronger B2B play later.

## 1. Competitors

### PMP prep

| Product | Price (2026) | Strengths | Gap vs. us |
|---|---|---|---|
| PMI Study Hall | Historically $49 / $79 per quarter ([PMI](https://www.pmi.org/shop/us/p-/digital-product/pmi-study-hall-pmp-plus-(subscription)/dp014)) | Official questions | Static multiple choice, no reasoning |
| PM PrepCast | $279–389 ([order page](https://www.project-management-prepcast.com/order)) | 2,000+ question simulator, analytics | Passive video, conventional questions |
| Andrew Ramdayal / TIA | Udemy roughly $15–100 (unverified) | Teaches the "PMI mindset", large community | Video plus multiple choice |
| AI PMP apps (2025–26) | Freemium, about $5–20/month ([App Store](https://apps.apple.com/app/id1502054904); [PMP Tutor](https://mwm.ai/apps/pmp-tutor-ai-exam-prep/6772922576)) | Cheap, mobile, AI explanations | Still question-and-answer |

Exam fee: about $405 for members and $555–675 for non-members ([PMStudyCircle](https://pmstudycircle.com/pmp-exam-fee/)). Business Environment rose from about 8% to 26% ([examcert](https://www.examcert.app/blog/new-pmp-exam-july-2026/)).

### General learning

- **Duolingo:** 58.7M DAU and 12.7M paid subscribers in Q2 2026 ([SEC](https://www.sec.gov/Archives/edgar/data/0001562088/000162828026053299/q2fy26duolingo6-30x26share.htm)). Super about $60/year, Max about $168/year.
- **Brilliant:** about $149/year; STEM only.
- **Anki:** free (iOS $24.99); the best for retention, but dry.
- **Quizlet Plus:** $35.99/year.
- **Khanmigo:** about $4/month, K-12.
- **Coursera Coach:** Gemini-powered. Role Play is for enterprise customers only ([CNET/AOL](https://www.aol.com/articles/coursera-soon-ai-personas-help-225323982.html)).
- **ChatGPT Study Mode** (July 2025), **Claude learning style**, **Gemini Guided Learning**.
- **OpenAI Certifications** plans certification prep inside Study Mode ([Website Planet](https://www.websiteplanet.com/news/openai-launches-jobs-and-certification-platforms/)). This is the biggest platform risk.
- **NotebookLM:** audio overviews and quizzes from your own sources ([Google](https://blog.google/technology/google-labs/notebooklm-student-features/)). Passive or recall-based.
- **Speechify:** about $139/year, which shows people pay for listening-based learning.

### Scenario and simulation learning

- **BranchTrack** (about $83–299/month) and **Articulate:** hand-scripted branches.
- **Yoodli:** AI role-play. Series B of $40M in December 2025, valued over $300M ([AI Insider](https://theaiinsider.tech/?p=41280)).
- **Mursion:** about $35–42M raised. **Bodyswaps:** a small VR company.
- **Hello Interview** ($79/year) and **ByteByteGo** (about $189–399/year): no "find the flaw in this design" drill.
- **Product-management simulators** (The Product Sandbox, PM Trainer): early and fragmented.

### Trades

- **Interplay Learning:** 3D/VR plus the SAM AI mentor, priced per seat ([OMNIA](https://www.omniapartners.com/suppliers-files/E-J/Interplay_Learning/Contract_Documents/R240309/R240309_Interplay_PRC_2025_09_26.pdf)). The closest incumbent.
- **Transfr:** XR, $90M+ raised, 400k learners ([Transfr](https://transfrinc.com/resources/news/new-career-training-programs-use-xr-technology-to-accelerate-skill-acquisition-for-todays-workforce)).
- **OSHA online:** $59–89 for OSHA 10 and $159 for OSHA 30 ([ClickSafety](https://www.clicksafety.com/courses/osha/osha-10/)). Slide-based.

**The gap:** competitors are passive, scripted, general, or need hardware. Nobody combines narrated performance of a task, planted taxonomy errors, a graded "why", and consequences.

## 2. Whitespace and defensibility

- **Prior art:** teachable agents such as Betty's Brain ([Hechinger](https://hechingerreport.org/kids-teaching-robots-is-this-the-future-of-education/)) and an LLM "protégé" study ([arXiv 2510.05271](https://arxiv.org/pdf/2510.05271)).
- **It's harder than it looks:** a student project found it was "harder than expected to get the AI to intentionally make mistakes" ([NuVu](https://cambridge.nuvustudio.com/projects/144297-teach-and-be-taught/tabs/151907-portfolio)).
- **Unguarded LLM grading is unreliable:** models raise about 4 false alarms per real misconception they detect ([arXiv 2605.23925](https://arxiv.org/html/2605.23925v1)).

**What's defensible:**
1. Curated, verified mistake libraries.
2. Rubric grading.
3. Consequence simulation.
4. A progress model built on mistake types.
5. A focus-first experience: 3–5 minute active bursts and hands-free audio. About 15.5M US adults have an ADHD diagnosis ([CDC via Psychiatric Times](https://www.psychiatrictimes.com/view/new-cdc-data-highlights-the-need-for-guidelines-on-adult-adhd)). Market it as "focus-friendly", never as a medical claim.
6. The domain-pack engine.

Learners *dislike* erroneous examples even when they learn more. Game design is how we close that motivation gap, not decoration.

## 3. Market signals (directional)

- **PMP:**
  - about 1.14M holders in 2021 (the last per-credential figure published);
  - probably 100k+ new PMPs a year globally;
  - r/pmp has about 85–107k members ([GummySearch](https://gummysearch.com/r/pmp)).
- **US corporate training:** $102.8B, with outside products and services at $16B (+29%) ([Training magazine](https://trainingmag.com/2025-training-industry-report/)).
- **Safety training:** about $4.3–5.8B worldwide, low-confidence estimates.
- **Construction:** needs 349k net new workers in 2026 ([NCCER](https://www.nccer.org/newsroom/report-construction-needs-349k-new-workers-in-2026/)).
- **Apprenticeships:** about 700k active apprentices; an executive order targets more than 1M ([EPI](https://www.epi.org/policywatch/executive-order-on-preparing-americans-for-high-paying-skilled-trade-jobs-of-the-future/)); $285M in FY2025 DOL funding.

## 4. Business models

| Model | Comparables | Pros | Cons |
|---|---|---|---|
| B2C lifelong-learning subscription | $60–149/year | Big market, serves the founder's own use | Hard to get users, competes with free AI tutors, churn |
| Certification niche (PMP first) | $49–389 | Urgent, deadline-driven need with high willingness to pay | Users leave once they pass, crowded, PMI intellectual property |
| B2B trades / apprenticeship / CTE | Per-seat, OSHA $59–89 | High contract value, funding exists, hackathon theme | Slow sales, liability, needs subject-matter experts |
| Corporate L&D | BranchTrack, Yoodli | $16B outside spend | Enterprise sales, demand for an authoring tool |
| Pack marketplace | Udemy revenue share | Scales content | Chicken-and-egg problem, quality control |

**Suggested sequence:** certification niche (3-month pass), then a pack authoring tool, then B2B, then a marketplace.

## 5. Go-to-market

**Wedge:** 30–50 "Stop the PM" scenarios mapped to the 2026 outline domains.

**Channels:** r/pmp, PMP Discords, LinkedIn study groups, "Can you catch the mistake?" short videos, and building in public while you prep.

**Riskiest assumptions and tests:**
1. **Will people come back?** Ship 10 free scenarios. Success: more than 25% return by day 7, and more than 3 scenarios per session.
2. **Is grading accurate?** Have 3 PMP holders rate 50 AI grades. Success: at least 90% agreement.
3. **Will people pay?** A $29/$49 3-month pass on a presale or fake-door page shown to 200–500 visitors. Success: at least 3% conversion.
4. **Does "focus-friendly" pull?** A/B landing page test against "PMP mistake-spotting".
5. **Does voice matter?** Offer both text and audio, and compare usage and cost.

## 6. Risks

- **PMI intellectual property:**
  - PMP, PMI and PMBOK are registered marks, and PMI polices exam content ([PMI exam security](https://www.pmi.org/it-it/pmiheadless/home/certifications/certification-resources/exam-security)).
  - PMBOK-based prep was litigated in *Mulcahy v. Cheetah Learning* ([8th Cir. 2004](https://law.resource.org/pub/us/case/reporter/F3/386/386.F3d.849.03-3112.html)).
  - Mitigation: original scenarios, no recalled exam items, no PMBOK text, nominative fair use, a non-affiliation disclaimer.
- **Accuracy and liability in trades:** subject-matter-expert verification, positioning as a supplement, no claims of OSHA card equivalence. The NEC is copyrighted by NFPA, so cite sections rather than quoting them (general knowledge, not researched here).
- **Cost:**
  - A text session is cheap.
  - Realtime speech-to-speech voice costs about $0.60–1.10 per 10 minutes ([Fora Soft](https://www.forasoft.com/article/openai-realtime-api-pricing)).
  - Mitigation: pre-render the narration with TTS, and use the LLM only for grading.
- **Platform:** OpenAI, Gemini and Coursera are adjacent. Own the verified content, the taxonomy, the progress data and the communities; packs could later be exposed to general assistants through MCP or apps.
- **Copying by incumbents:** Interplay or PrepCast could add the mode. Speed and niche focus are the defense, with acquisition as a possible exit.

## Positioning (draft)

> **For** busy professionals preparing for high-stakes skills such as the PMP who struggle to stay focused through videos and question banks, **Stop the Apprentice** is a scenario-based practice app **that** turns studying into catching an AI apprentice's mistakes before they cause damage. **Unlike** question banks, video courses or generic AI tutors, every scenario comes from a verified library of real-world errors. It grades *why* you're right, shows the consequences of what you miss, and tracks the exact mistakes you're blind to, all in five-minute bursts.

## Ranked wedges

1. **PMP "Stop the PM"**, B2C at $29–49 for a 3-month pass. Recommended.
2. **"Stop the Architect"**, prosumer at about $79/year. Best as the second pack.
3. **Trades apprenticeship B2B pilot.** Once grading is proven, ideally with an instructor advisor.

**Recommendation:** spend 60–90 days on the PMP wedge, built as swappable packs from day one. Keep a free trades demo pack, such as "spot the lockout/tagout mistake", for conversations with apprenticeship programs.

## Data caveats

- There is no official per-credential PMP count after 2021.
- No FY2025 DOL apprenticeship table could be retrieved.
- Several prices come from aggregator sites.
- Market-size reports are low-confidence.
