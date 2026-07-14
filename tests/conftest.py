"""The test suite must never touch the network, same invariant as every other
opt-in integration in this codebase (Stripe/Gemini/Agent Engine all default off).
`settl.config.load_dotenv()` uses `os.environ.setdefault`, so a developer's local
.env - e.g. SETTL_USE_SUPABASE=1 for manual/live testing - would otherwise leak
into pytest and make BoardState (built at import time by settl.api.main) attempt a
real Postgres connection during collection. Force it off before anything imports
settl.api.main, regardless of what's in .env or the shell.
"""

import os

os.environ["SETTL_USE_SUPABASE"] = "0"
