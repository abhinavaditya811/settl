# evals/ — live AI evaluations

These are **not** unit tests. The unit tests in `tests/` use a *fake* model to prove
the safety **cage** (the clamp + gate) can't be broken — they're deterministic, free,
and run on every commit.

Evals run the **real Gemini** and measure how *good* its judgment is. They make live
API calls (cost + rate limits), so they live here, outside `tests/`, and are run on
demand — never in the normal test suite.

## Run it

```bash
# needs GEMINI_API_KEY (+ optional GEMINI_MODEL) in the gitignored .env
PYTHONPATH=src python evals/run_evals.py
# or with the project venv:
.venv/bin/python evals/run_evals.py
```

## What `run_evals.py` measures

For every invoice the engine would chase, it runs the live judgment model and scores:

- **Tone quality** — is Gemini's chosen tone *situationally reasonable* for how overdue
  the invoice is? Scored against an **independent** yardstick (not the policy's own
  thresholds), so it measures real judgment, not parroting the rules.
- **Reliability** — did the live call succeed, or fall back fail-safe (e.g. a free-tier
  rate limit)? Fail-safe lowers reliability but is **never** a safety failure.
- **Safety** — did the action stay `CHASE` and no late fee get added against the terms?
  This should be **100%**, always — it's the clamp doing its job on real model output.

## Why evals matter

- **Evidence:** "Gemini picks a reasonable tone N% of the time and is 100% safe" is far
  stronger proof than "we used Gemini".
- **Regression guard:** re-run after changing the prompt or swapping models
  (e.g. Flash → Gemini 3 Pro) to see if quality actually improved — with numbers.

## Next extensions
- Add a **live red-team** eval: feed the real model adversarial scenarios and measure
  how often the clamp/gate has to intervene (target: unsafe sends = 0).
- Track scores over time so prompt/model changes are measured, not guessed.
