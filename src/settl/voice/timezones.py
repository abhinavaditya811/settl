"""Debtor-local time for the call-window check (spec §3a.4).

The gate's ``VOICE_OUTSIDE_HOURS`` rule needs the DEBTOR's local clock, not ours -
9am in New York is 6am in California, and 6am is not a compliant time to ring anyone.
This module maps a US state to its dominant IANA timezone and converts "now" into
that local time; callers feed the result into ``voice_context_*`` as ``now_local``.

Conservative by design: an unknown state returns ``None``, and the caller must treat
that as "cannot verify the window" (our CLIs then only dial with explicit consent;
production should resolve the state from the debtor record before dialing). The
mapping uses each state's dominant zone - the handful of split-zone states (TN, KY,
IN, …) get their majority zone, which is at most one hour off and inside the 8am-9pm
window's comfort margin.
"""

from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo

# State → dominant IANA zone. Split-zone states carry their majority zone.
STATE_TIMEZONES: dict[str, str] = {
    "AL": "America/Chicago", "AK": "America/Anchorage", "AZ": "America/Phoenix",
    "AR": "America/Chicago", "CA": "America/Los_Angeles", "CO": "America/Denver",
    "CT": "America/New_York", "DE": "America/New_York", "DC": "America/New_York",
    "FL": "America/New_York", "GA": "America/New_York", "HI": "Pacific/Honolulu",
    "ID": "America/Boise", "IL": "America/Chicago", "IN": "America/Indiana/Indianapolis",
    "IA": "America/Chicago", "KS": "America/Chicago", "KY": "America/New_York",
    "LA": "America/Chicago", "ME": "America/New_York", "MD": "America/New_York",
    "MA": "America/New_York", "MI": "America/Detroit", "MN": "America/Chicago",
    "MS": "America/Chicago", "MO": "America/Chicago", "MT": "America/Denver",
    "NE": "America/Chicago", "NV": "America/Los_Angeles", "NH": "America/New_York",
    "NJ": "America/New_York", "NM": "America/Denver", "NY": "America/New_York",
    "NC": "America/New_York", "ND": "America/Chicago", "OH": "America/New_York",
    "OK": "America/Chicago", "OR": "America/Los_Angeles", "PA": "America/New_York",
    "RI": "America/New_York", "SC": "America/New_York", "SD": "America/Chicago",
    "TN": "America/Chicago", "TX": "America/Chicago", "UT": "America/Denver",
    "VT": "America/New_York", "VA": "America/New_York", "WA": "America/Los_Angeles",
    "WV": "America/New_York", "WI": "America/Chicago", "WY": "America/Denver",
}


def zone_for_state(state: str | None) -> ZoneInfo | None:
    """The dominant IANA zone for a US state (None when unknown)."""
    if state is None:
        return None
    name = STATE_TIMEZONES.get(state.strip().upper())
    return ZoneInfo(name) if name else None


def debtor_local_time(state: str | None, at_utc: datetime | None = None) -> time | None:
    """"Now" on the debtor's clock, for the gate's call-window check.

    ``at_utc`` is injectable for tests; production omits it. Returns None when the
    state is unknown - the caller must NOT assume in-window (fail safe, not open)."""
    zone = zone_for_state(state)
    if zone is None:
        return None
    moment = at_utc if at_utc is not None else datetime.now(timezone.utc)
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(zone).time()
