---
name: structured-analytic-reasoning
description: Structured Analytic Techniques applied to agent reasoning. Use before drawing conclusions from collected evidence, when deciding between competing explanations, when the evidence is ambiguous or adversarial, or whenever the user asks for rigorous/structured analysis of findings. Encodes ACH (Analysis of Competing Hypotheses), Premortem, evidence grading, and uncertainty quantification from Structured Analytic Techniques for Intelligence Analysis.
---

# Structured Analytic Reasoning (ACH + Premortem)

30 operational rules distilled from *Structured Analytic Techniques for Intelligence Analysis* (Pherson & Heuer 3rd ed). Apply as a checklist **before** stating conclusions from collected evidence. Each rule is checkable.

## Core Principle

Analysis = evidence + hypotheses, advanced by **falsification**. The most defensible hypothesis is the one with the least opposing evidence. ~1/4 of key assumptions collapse when tested — assumptions must be explicit and testable.

## Phase 1: Generate Competing Hypotheses (before concluding)

1. **Generate 3+ mutually exclusive hypotheses** — never lock onto the first explanation that fits.
2. **Key assumptions check** — list every implicit assumption; for each ask "if this were false, what changes?".
3. **Reverse the hypothesis** — if you believe X, write down what would be true if NOT-X.
4. **Devil's advocate is structural, not personal** — attack the plan, not the author; adversarial collaboration over debate.
5. **Multiple hypotheses from different families** — don't generate variants of one idea; seek fundamentally different explanations.

## Phase 2: Evidence Matrix (ACH 9-step core)

6. **List all evidence** — every datum that bears on the question, including weak/ambiguous items.
7. **Score evidence vs each hypothesis**: C = consistent, I = inconsistent, NA = not applicable.
8. **Diagnostic value first** — evidence that distinguishes hypotheses (C for one, I for another) outranks evidence consistent with all.
9. **Look for inconsistency, not support** — a hypothesis survives by having fewest I's, not most C's.
10. **Discard evidence consistent with all hypotheses** — it cannot discriminate; keep only diagnostic evidence in the final matrix.
11. **Most likely hypothesis = fewest I's**, not the one with the most confirming anecdotes.

## Phase 3: Falsification Discipline

12. **Actively hunt counter-evidence** — before finalizing, deliberately search for what would disprove your conclusion.
13. **Inconsistency detector** — flag data points that do NOT fit the expected pattern; they are the highest-value findings.
14. **What-if test** — if the opposite were true, what evidence would you expect to see? Look for it.
15. **Deception check** — when the source could be adversarial, ask: what would a deceiver omit or fabricate? (MOM/POP pattern)
16. **Independent reproduction** — any conclusion from a single source, even a famous one, must be independently verifiable.

## Phase 4: Uncertainty Quantification

17. **Quantify uncertainty** — "very likely" ≈ 75%±12%, not a vague word. Assign numeric probabilities.
18. **Confidence tiers for every finding** — confirmed (≥3 independent sources) / likely / weak / unsubstantiated / unknown.
19. **Downgrade wording when evidence is thin** — insufficient evidence → "high possibility", never a flat claim.
20. **Report the runner-up** — always state the second-most-likely hypothesis and why it lost.

## Phase 5: Premortem (before committing)

21. **Premortem** — assume the conclusion/plan has already failed in 6 months; write down why.
22. **Structured self-critique** — put on the black hat; attack your own conclusion as hard as an opponent would.
23. **High-impact low-probability scan** — explicitly consider scenarios that are unlikely but catastrophic if wrong.
24. **Scenario + indicator loop** — for forward-looking claims, define observable indicators that would confirm or refute later.

## Output Discipline

25. **Label every statement** — FACT / ASSUMPTION / INFERENCE on each reasoning step; never blur them.
26. **Auditable chain** — every conclusion traces back to evidence with source + timestamp; reproducible by another agent.
27. **No AI-only verdicts** — AI conclusions must cite checkable sources; unverifiable claims are marked unknown.
28. **Separate evidence from interpretation** — raw findings first, then your reading of them.
29. **Right of reply** — when the analysis concerns a person/entity, consider their possible rebuttal before publishing.
30. **When in doubt, present alternatives** — if evidence cannot discriminate, deliver both hypotheses with their evidence, not a forced single answer.
