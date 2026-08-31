---
name: coding-discipline
description: Applies distilled engineering discipline from classic books (Clean Code, Refactoring, DDIA, System Design Interview, game-design practice, reverse-engineering methodology) to coding, design, review, and data work. Use before writing code, during code review, when designing systems or data models, when refactoring, or whenever the user asks for disciplined/rigorous engineering. 
---

# Coding Discipline

30 operational rules distilled from six classic engineering books. Use as a checklist when implementing, reviewing, designing, or refactoring. Each rule is checkable: an agent can verify compliance from the code or the plan.

## Code (Clean Code)

1. **Names express intent** — names answer why-exists / what-does / how-used. Reject placeholder names (result2, temp, data, handle).
2. **Functions do one thing** — split when >~20 lines or when the description needs a second "and". More than 2 params needs a reason; more than 4 must be wrapped.
3. **Comments explain "why" only** — comments that restate what/how are code failure; stale comments are worse than none.
4. **Errors via exceptions, not codes** — never pass/return null; use Optional/special-case objects.
5. **Tests before behavior** — behavior changes first update the test; tests assert behavior, not implementation.
6. **Bad-smell self-check before commit** — magic numbers, deep nesting, duplication, debug leftovers, commented-out code, dead code.
7. **Three-strikes rule** — abstract on the third duplicate; never generalize early.

## Refactoring (Fowler)

8. **Refactor = behavior-preserving change** — refactor commits must have zero behavioral diff.
9. **No tests, no refactor** — write characterization tests first.
10. **Small steps, always runnable** — one technique per step, run tests, continue; large refactors become commit chains.
11. **Smell → technique mapping** — look up the catalog, never "rewrite by feel".
12. **Separate commits** — a commit does one thing: feature or refactor, not both.

## Data (DDIA)

13. **Data flow before code** — draw the data model/flow before writing APIs.
14. **Bidirectional compatibility** — schema changes must read old data and be readable by old code; only add defaulted fields, never delete.
15. **Idempotency by default** — distributed writes assume duplicate/out-of-order/late delivery; write operations carry idempotency keys.
16. **Estimate before designing** — load parameters table (QPS/storage/bandwidth/percentile latency) first.
17. **Explicit failure modes** — every component documents failure mode + degradation path; never use wall-clock as ordering authority.

## Architecture (System Design Interview)

18. **Clarify four things first** — functional, non-functional, scale, constraints; numbers first, assumptions labeled "TBD".
19. **Order-of-magnitude estimates** — QPS→storage→bandwidth; peak = average ×2–3; two digits of precision.
20. **Explicit trade-offs** — each component choice lists its trade-off; default SQL, justify alternatives.
21. **Cache consistency explicit** — consistency window + invalidation + hot-key strategy.
22. **Single-point self-check** — DB primary down? cache wiped? queue backlog? degradation paths must actually work.

## Design & Content Reuse (Game Design trilogy)

23. **Experience goal first** — first line of the design doc: what the user feels; every decision answers back to it.
24. **Lens self-review** — review from 3–5 perspectives (psychology/mechanics/aesthetics/tech/constraints).
25. **Prototype first** — a rough working prototype beats a perfect doc; validate the core assumption, then refine.
26. **Parameterize reuse** — design the parameter space on day one; abstract at the third variant, never copy-paste variants.
27. **Name the problem before the pattern** — pattern follows problem; composition over deep inheritance.

## Reverse Engineering Methodology

28. **Structure before detail** — imports/strings/call-graph first, never linear-read the binary.
29. **Verify static with dynamic** — key inferences get breakpoint confirmation; label notes [FACT]/[INFER]/[GUESS].
30. **ABI is the contract** — confirm calling conventions before analysis; performance claims need architecture + measurement/citation.

## Agent Workflow

- **Before implementing**: run rules 13, 16, 18, 23 (design + data + goal).
- **While coding**: rules 1–4, 7, 14, 15, 26.
- **Before committing**: rules 5, 6, 8, 10, 12, 17.
- **When reviewing**: run all 30 as a checklist; report each violation with the rule number and evidence.

## Resources

Full per-book digests live in the bundled resources (01-clean-code.md … 06-reversing.md + DISCIPLINE.md synthesis) when shipped with this skill; otherwise the 30 rules above are self-sufficient.
