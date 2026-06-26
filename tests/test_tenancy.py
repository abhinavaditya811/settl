"""TenantConfig flowing through the engine (SCHEMA.md §3).

Proves the three wired slices: payments.default_payment_link → sender resolution,
policy → gate frequency bounds (a tenant can only tighten), voice → drafting; plus
the per-tenant batch runner's isolation (one orchestrator/sender per tenant).
"""

from datetime import date, timedelta
from decimal import Decimal

from settl.compliance.gate import ComplianceGate, GateDecision
from settl.data import config_for, load_synthetic_invoices
from settl.orchestrator import Orchestrator, TerminalState, run_multitenant
from settl.tenancy import DEFAULT_POLICY, TenantConfig, policy_with
from settl.schema.invoice import (
    Channel,
    ContactDirection,
    Invoice,
    InvoiceStatus,
    PriorContact,
    Source,
)


def _repeat_payer(*, payment_link=None, prior_days=(20,), tenant_id="t_test") -> Invoice:
    """Clean B2B repeat payer (not first contact) that normally CHASEs → SENDs."""
    today = date.today()
    prior = [
        PriorContact(
            occurred_on=today - timedelta(days=d),
            direction=ContactDirection.OUTBOUND,
            channel=Channel.EMAIL,
            summary="reminder",
        )
        for d in prior_days
    ]
    return Invoice(
        invoice_id="TC-1", tenant_id=tenant_id, source=Source.STRIPE, source_ref="x",
        amount_due=Decimal("900.00"), currency="USD",
        issue_date=today - timedelta(days=50), due_date=today - timedelta(days=20),
        status=InvoiceStatus.OPEN, debtor_name="Acme", debtor_email="ap@acme.test",
        is_b2b=True, late_fee_allowed=True, payment_link=payment_link,
        prior_contacts=prior, as_of_date=today,
    )


# --- config loading -----------------------------------------------------------


def test_default_policy_matches_engine_thresholds():
    # An un-configured run must behave exactly as before.
    assert DEFAULT_POLICY.max_touches == 3
    assert DEFAULT_POLICY.frequency_window_days == 7


def test_config_for_loads_sample_and_falls_back():
    bw = config_for("t_brightwork")
    assert bw.payments.default_payment_link
    assert bw.identity.oauth_token_ref == "tok_brightwork"
    # Harborside overrides only what it changes; the rest are global defaults.
    hs = config_for("t_harborside")
    assert hs.policy.max_touches == 2
    assert hs.policy.success_fee_pct == DEFAULT_POLICY.success_fee_pct
    # Unknown tenant → bare default-policy config, never a crash.
    unknown = config_for("t_nope")
    assert unknown.policy == DEFAULT_POLICY
    assert unknown.payments.default_payment_link is None


# --- payments slice → sender resolution --------------------------------------


def test_tenant_default_link_resolves_a_linkless_invoice():
    inv = _repeat_payer(payment_link=None, tenant_id="t_brightwork")
    config = TenantConfig(
        tenant_id="t_brightwork",
        payments=config_for("t_brightwork").payments,
    )
    res = Orchestrator(config=config).run_one(inv)
    assert res.terminal_state is TerminalState.SENT
    # The sent message used the tenant default link, not the placeholder.
    sent_step = next(s for s in res.steps if s.agent == "sender")
    assert "test_brightwork_default" in sent_step.reasoning
    assert "{{payment_link}}" not in sent_step.reasoning


def test_no_link_and_no_tenant_default_hard_fails():
    inv = _repeat_payer(payment_link=None, tenant_id="t_nope")
    res = Orchestrator(config=config_for("t_nope")).run_one(inv)
    # Nothing resolves → the sender withholds; the chase is never reported SENT.
    assert res.terminal_state is TerminalState.ESCALATED
    sender_step = next((s for s in res.steps if s.agent == "sender"), None)
    assert sender_step is not None and "unresolved payment link" in sender_step.reasoning


# --- policy slice → gate (tenant can only tighten) ---------------------------


def test_stricter_tenant_policy_tightens_the_frequency_gate():
    # Two outbound touches within the window: clears the default gate (max 3),
    # trips Harborside's stricter gate (max 2).
    inv = _repeat_payer(prior_days=(2, 5))
    assert ComplianceGate().evaluate(inv).decision is GateDecision.PASS
    strict = ComplianceGate(frequency_max=2)
    result = strict.evaluate(inv)
    assert result.decision is GateDecision.ESCALATE
    assert "FREQUENCY_LIMIT" in result.codes


# --- voice slice → drafting ---------------------------------------------------


def test_voice_slice_grounds_the_draft():
    from settl.agents.drafting import DraftingAgent
    from settl.agents.drafting.grounding import StaticVoiceGrounding
    from settl.agents.strategy.policy import decide_strategy

    inv = _repeat_payer(payment_link="https://buy.stripe.com/test_x", tenant_id="t_brightwork")
    voice = config_for("t_brightwork").voice.voice_block
    msg = DraftingAgent(grounding=StaticVoiceGrounding(voice)).draft(inv, decide_strategy(inv))
    assert msg.grounded is True  # the tenant's voice reached the drafter
    # ...and an empty voice does not falsely mark a draft grounded.
    plain = DraftingAgent(grounding=StaticVoiceGrounding("")).draft(inv, decide_strategy(inv))
    assert plain.grounded is False


# --- policy slice → strategy (tone clamp + cooldown) -------------------------


def test_allowed_tones_clamps_strategy_tone_downward():
    from settl.agents.strategy.policy import Tone, decide_strategy

    # 60 days overdue → would be FINAL; a tenant that forbids FINAL gets FIRM.
    today = date.today()
    inv = _repeat_payer(prior_days=(20,))
    inv = inv.model_copy(update={"due_date": today - timedelta(days=60)})
    assert decide_strategy(inv).tone is Tone.FINAL
    clamped = decide_strategy(inv, allowed_tones=("friendly_reminder", "firm_reminder"))
    assert clamped.tone is Tone.FIRM


def test_min_days_between_touches_drives_the_cooldown():
    from settl.agents.strategy.policy import Action, decide_strategy

    # Last touch 3 days ago: default cooldown (2) lets it chase; a stricter
    # min_days_between_touches=5 holds it.
    inv = _repeat_payer(prior_days=(3,))
    assert decide_strategy(inv).action is Action.CHASE
    held = decide_strategy(inv, min_days_between_touches=5)
    assert held.action is Action.HOLD


# --- per-tenant batch isolation ----------------------------------------------


def test_run_multitenant_covers_all_and_groups_by_tenant():
    invoices = load_synthetic_invoices()
    results = run_multitenant(invoices, config_for)
    assert {r.invoice_id for r in results} == {i.invoice_id for i in invoices}
    assert len(results) == len(invoices)
    for r in results:
        assert isinstance(r.terminal_state, TerminalState)
