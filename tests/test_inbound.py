"""Inbound classification (SCHEMA.md §7) - the lane a debtor's reply routes to."""

from settl.agents.inbound import (
    InboundAgent,
    InboundLane,
    classify_deterministic,
    thread_classifications,
)
from settl.data import load_synthetic_invoices
from settl.schema.invoice import Channel, ContactDirection, PriorContact


def _by_id():
    return {inv.invoice_id: inv for inv in load_synthetic_invoices()}


def test_dispute_language_classifies_as_dispute():
    inv = _by_id()["INV-024"]  # fixture carries an inbound dispute reply
    result = classify_deterministic(inv, "I dispute this charge, it's not mine")
    assert result.lane is InboundLane.DISPUTE


def test_opt_out_language_classifies_as_opt_out_not_benign():
    # Regression: "don't send me any emails" fell through to BENIGN and drafted
    # a further auto-reply - INBOUND_OPT_OUT was voice-only ("stop calling" etc.)
    # and never wired into the email classifier at all.
    inv = _by_id()["INV-001"]
    result = classify_deterministic(inv, "Please don't send me any emails for this invoice.")
    assert result.lane is InboundLane.OPT_OUT


def test_unsubscribe_classifies_as_opt_out():
    inv = _by_id()["INV-001"]
    result = classify_deterministic(inv, "unsubscribe")
    assert result.lane is InboundLane.OPT_OUT


def test_stop_sending_emails_classifies_as_opt_out():
    # Regression: real-mailbox testing found this phrasing ("stop sending... emails",
    # not "stop emailing" / "don't send") also fell through to BENIGN.
    inv = _by_id()["INV-001"]
    result = classify_deterministic(inv, "Can you stop sending me emails?")
    assert result.lane is InboundLane.OPT_OUT


def test_payment_plan_language_classifies_as_payment_plan_request():
    inv = _by_id()["INV-001"]
    result = classify_deterministic(inv, "Can I set up a payment plan for this?")
    assert result.lane is InboundLane.PAYMENT_PLAN_REQUEST


def test_no_signal_classifies_as_benign():
    inv = _by_id()["INV-001"]
    result = classify_deterministic(inv, "Thanks, will take care of it this week")
    assert result.lane is InboundLane.BENIGN


def test_rising_friction_across_thread_history_escalates_even_without_a_hard_trigger():
    inv = _by_id()["INV-001"]
    friction_thread = inv.model_copy(
        update={
            "prior_contacts": [
                *inv.prior_contacts,
                PriorContact(
                    occurred_on=inv.as_of_date,
                    direction=ContactDirection.INBOUND,
                    channel=Channel.EMAIL,
                    summary="not happy about this",
                    classification="dispute",
                ),
                PriorContact(
                    occurred_on=inv.as_of_date,
                    direction=ContactDirection.INBOUND,
                    channel=Channel.EMAIL,
                    summary="unclear reply",
                    classification="escalate_low_confidence",
                ),
            ]
        }
    )
    result = classify_deterministic(friction_thread, "ok whatever")
    assert result.lane is InboundLane.ESCALATE_LOW_CONFIDENCE


def test_thread_classifications_reads_only_inbound_history():
    inv = _by_id()["INV-006"]  # has one outbound + one inbound prior contact
    history = thread_classifications(inv)
    # Neither prior contact in this fixture carries a classification yet (written
    # before the classifier existed) - the reader still only considers inbound rows.
    assert all(
        c.classification is None
        for c in inv.prior_contacts
        if c.direction is ContactDirection.OUTBOUND
    )
    assert history == [
        c.classification
        for c in inv.prior_contacts
        if c.direction is ContactDirection.INBOUND and c.classification
    ]


def test_inbound_agent_logs_the_decision():
    from settl.audit import ExecutionLog

    log = ExecutionLog()
    agent = InboundAgent(log=log)
    inv = _by_id()["INV-024"]
    result = agent.classify(inv, "I dispute this charge")
    assert result.lane is InboundLane.DISPUTE
    entries = log.for_invoice(inv.invoice_id)
    assert any(e.agent == "inbound_classifier" and e.decision == "dispute" for e in entries)
