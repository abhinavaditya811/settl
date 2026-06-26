"""Live demo of the Week-3 Gemini judgment seam.

Run it to SEE Gemini refine the strategy's tone on real (synthetic) invoices, with
the safety clamp guaranteeing the model can never change the action or bypass the
gate. Reads GEMINI_API_KEY / GEMINI_MODEL from .env; with no key (or if the free
tier is rate-limited) it stays deterministic and says so - that's the fail-safe.

    PYTHONPATH=src python demo_judgment.py
    # or, with the project venv:
    .venv/bin/python demo_judgment.py
"""

from __future__ import annotations

from settl.agents.strategy import GeminiJudgmentModel, StrategyAgent, decide_strategy
from settl.audit import ExecutionLog
from settl.config import load_dotenv
from settl.data import load_synthetic_invoices

SHOWCASE = ["INV-001", "INV-002", "INV-008"]  # 7d / 30d / 100d overdue


def main() -> None:
    load_dotenv()
    invoices = {i.invoice_id: i for i in load_synthetic_invoices()}
    print("Settl - Week 3 judgment demo  (rules -> Gemini -> safety clamp)")
    print("=" * 64)
    for inv_id in SHOWCASE:
        inv = invoices[inv_id]
        policy = decide_strategy(inv)
        log = ExecutionLog()
        final = StrategyAgent(log=log, model=GeminiJudgmentModel(log=log)).decide(inv)

        j = [e for e in log.entries if e.agent == "strategy_judgment"]
        status = j[0].decision.upper() if j else "N/A"
        note = j[0].reasoning if j else ""

        ptone = policy.tone.value if policy.tone else "-"
        ftone = final.tone.value if final.tone else "-"
        print(f"\n{inv_id}  ({inv.days_overdue}d overdue, B2B={inv.is_b2b})")
        print(f"  1. rules (policy) : tone={ptone}, late_fee={policy.include_late_fee}, action={policy.action.value}")
        print(f"  2. gemini judgment: {status}  -> {note}")
        print(f"  3. final (clamped): tone={ftone}, late_fee={final.include_late_fee}, action={final.action.value}")
        print(f"     SAFETY CHECK   : action unchanged = {final.action == policy.action}")

    print("\n" + "=" * 64)
    print("The action NEVER changes - the model only nudges tone/late-fee, and the")
    print("compliance gate still decides every send downstream.")


if __name__ == "__main__":
    main()
