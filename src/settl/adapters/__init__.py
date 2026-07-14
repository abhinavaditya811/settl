"""Source adapters: raw external formats -> canonical Invoice (CLAUDE.md).

One module per source (csv_adapter.py today; a future pdf_adapter.py/photo adapter
slots in behind the same seam). Nothing downstream - orchestrator, strategy,
compliance - ever sees a source-specific shape; adapters are the only place that
special-cases a format.
"""
