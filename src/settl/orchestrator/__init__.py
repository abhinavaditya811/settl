"""Orchestrator: the routing spine that drives every invoice through the pipeline
(strategy → draft → compliance gate → send) and decides the unpaid loop."""

from settl.orchestrator.loop import LoopDecision, next_touch, next_touch_after_reconcile
from settl.orchestrator.pipeline import Orchestrator, default_draft
from settl.orchestrator.result import (
    PipelineResult,
    PipelineStep,
    TerminalState,
)
from settl.orchestrator.runtime import NoOpRuntime, OrchestratorRuntime
from settl.orchestrator.tenanted import run_multitenant
from settl.orchestrator.trace import (
    describe_details,
    format_loop_plan,
    format_summary,
    format_trace_table,
)

__all__ = [
    "LoopDecision",
    "NoOpRuntime",
    "Orchestrator",
    "OrchestratorRuntime",
    "PipelineResult",
    "PipelineStep",
    "TerminalState",
    "default_draft",
    "next_touch",
    "next_touch_after_reconcile",
    "run_multitenant",
    "describe_details",
    "format_loop_plan",
    "format_summary",
    "format_trace_table",
]
