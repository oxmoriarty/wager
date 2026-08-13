# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Wager — Match Monitoring Intelligent Contract.

Responsibilities (PROJECT.md §6):
  - Live score monitoring
  - Match state updates
  - Detect postponements (and suspensions/abandonments/cancellations)

Per PROJECT.md §6's governing principle, this contract owns the
non-deterministic reasoning involved in checking a live match's current
state (fetching a web source and extracting structured status/score data
via an LLM). Wager's backend only ever reads the validated result below
and syncs it into its own `Match` table — it never independently decides
what a match's current score or status is.

Deployment target: GenLayer Bradbury Testnet.
"""

from genlayer import *
from dataclasses import dataclass
from datetime import datetime, timezone
import typing

# Mirrors Wager's Prisma `MatchStatus` enum (prisma/schema.prisma) exactly
# — the backend sync layer maps these strings 1:1 onto that enum.
ALLOWED_STATUSES = {
    "SCHEDULED",
    "LIVE",
    "POSTPONED",
    "SUSPENDED",
    "FINISHED",
    "ABANDONED",
    "CANCELED",
}

# No score is known yet (match hasn't started, or the source doesn't show
# one). Distinguishes "unknown" from a genuine 0-0 scoreline.
NO_SCORE = -1

MAX_PAGE_CHARS = 15000


@allow_storage
@dataclass
class MonitoredMatch:
    fixture_id: str
    home_team: str
    away_team: str
    source_url: str
    status: str
    home_score: i32
    away_score: i32
    last_checked_at: str


class MatchMonitoring(gl.Contract):
    owner: Address
    operators: DynArray[Address]
    matches: TreeMap[str, MonitoredMatch]
    fixture_ids: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.operators.append(gl.message.sender_address)

    # ------------------------------------------------------------------
    # Access control (identical pattern to FixtureDiscovery, see that
    # contract for rationale)
    # ------------------------------------------------------------------

    @gl.public.write
    def add_operator(self, operator: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner can add operators")
        address = Address(operator)
        if address not in self.operators:
            self.operators.append(address)

    @gl.public.write
    def remove_operator(self, operator: str) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the owner can remove operators")
        address = Address(operator)
        for i in range(len(self.operators)):
            if self.operators[i] == address:
                del self.operators[i]
                return

    def _require_operator(self) -> None:
        sender = gl.message.sender_address
        if sender == self.owner:
            return
        if sender in self.operators:
            return
        raise gl.vm.UserError(
            "Only an authorized operator can trigger match monitoring"
        )

    # ------------------------------------------------------------------
    # Monitoring
    # ------------------------------------------------------------------

    @gl.public.write
    def check_match(
        self,
        fixture_id: str,
        home_team: str,
        away_team: str,
        source_url: str,
    ) -> dict[str, typing.Any]:
        """
        Fetches `source_url`, extracts the match's current status and
        score via LLM, reaches validator consensus on the exact
        extracted tuple, then stores and returns the result.

        Safe to call repeatedly for the same fixture as it progresses
        from SCHEDULED -> LIVE -> FINISHED (or into POSTPONED/SUSPENDED/
        ABANDONED/CANCELED) — each call simply overwrites the stored
        state with the freshly observed one.
        """
        self._require_operator()

        fixture_id = fixture_id.strip()
        home_team = home_team.strip()
        away_team = away_team.strip()
        source_url = source_url.strip()
        if not fixture_id:
            raise gl.vm.UserError("fixture_id must not be empty")
        if not home_team or not away_team:
            raise gl.vm.UserError("home_team and away_team must not be empty")
        if not source_url:
            raise gl.vm.UserError("source_url must not be empty")

        def leader_fn():
            page_text = gl.nondet.web.render(
                source_url, mode="text", wait_after_loaded="3s"
            )
            page_text = page_text[:MAX_PAGE_CHARS]

            prompt = f"""You are determining the current status and score of a
football match from the web page content below.

Match: {home_team} vs {away_team}

Web page content:
{page_text}

Determine the match's current status using EXACTLY one of these values:
- "SCHEDULED": the match has not kicked off yet
- "LIVE": the match is currently in progress
- "FINISHED": the match has reached full-time with a final result
- "POSTPONED": the match was rescheduled to a different date/time
  before kickoff
- "SUSPENDED": the match was temporarily halted during play (e.g.
  weather, crowd trouble, floodlight failure) and is expected to
  resume or has an uncertain resumption
- "ABANDONED": the match was permanently stopped during play and will
  not resume or be replayed
- "CANCELED": the match was called off entirely and will not be
  rescheduled

Also determine the current score if one is available (during or after
the match). If no score is available (e.g. status is SCHEDULED,
POSTPONED, or CANCELED with no match ever played), set both scores to
null.

If you cannot confidently determine the status from the page content,
respond with status "SCHEDULED" and null scores rather than guessing.

Respond using ONLY the following JSON format, nothing else:
{{
    "status": "...",
    "home_score": <integer or null>,
    "away_score": <integer or null>
}}
"""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(result, dict):
                raise gl.vm.UserError("LLM did not return a JSON object")

            status = str(result.get("status", "")).strip().upper()
            if status not in ALLOWED_STATUSES:
                raise gl.vm.UserError(f"LLM returned an unrecognized status: {status}")

            home_score = result.get("home_score")
            away_score = result.get("away_score")

            def to_score(value) -> int:
                if value is None:
                    return NO_SCORE
                try:
                    parsed = int(value)
                except (TypeError, ValueError):
                    raise gl.vm.UserError(f"Non-integer score returned: {value}")
                if parsed < 0:
                    raise gl.vm.UserError(f"Negative score returned: {parsed}")
                return parsed

            return {
                "status": status,
                "home_score": to_score(home_score),
                "away_score": to_score(away_score),
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                # Leader errored (unreachable source, bad status value,
                # non-integer score, etc). Disagree so the network
                # rotates to a new leader rather than accepting nothing.
                return False

            leader_data = leaders_res.calldata
            if (
                not isinstance(leader_data, dict)
                or "status" not in leader_data
                or "home_score" not in leader_data
                or "away_score" not in leader_data
            ):
                return False

            try:
                my_result = leader_fn()
            except Exception:
                # Validator itself couldn't extract a valid result either
                # — treat as disagreement rather than propagating the
                # exception, so the network can rotate cleanly.
                return False

            # Status and score are objective facts, not free-form text —
            # unlike fixture discovery's fuzzy team-name matching, an
            # honest independent extraction should land on the exact
            # same tuple. Require exact equality.
            return (
                my_result["status"] == leader_data["status"]
                and my_result["home_score"] == leader_data["home_score"]
                and my_result["away_score"] == leader_data["away_score"]
            )

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        now_iso = datetime.now(timezone.utc).isoformat()

        if fixture_id not in self.matches:
            self.fixture_ids.append(fixture_id)

        self.matches[fixture_id] = MonitoredMatch(
            fixture_id=fixture_id,
            home_team=home_team,
            away_team=away_team,
            source_url=source_url,
            status=result["status"],
            home_score=i32(result["home_score"]),
            away_score=i32(result["away_score"]),
            last_checked_at=now_iso,
        )

        return {
            "fixture_id": fixture_id,
            "status": result["status"],
            "home_score": None if result["home_score"] == NO_SCORE else result["home_score"],
            "away_score": None if result["away_score"] == NO_SCORE else result["away_score"],
            "last_checked_at": now_iso,
        }

    # ------------------------------------------------------------------
    # Read methods (consumed by Wager's backend sync job)
    # ------------------------------------------------------------------

    @gl.public.view
    def get_monitored_fixture_ids(self) -> list[str]:
        return [fid for fid in self.fixture_ids]

    @gl.public.view
    def get_match_state(self, fixture_id: str) -> dict[str, typing.Any]:
        match = self.matches.get(fixture_id, None)
        if match is None:
            return {}
        return {
            "fixture_id": match.fixture_id,
            "home_team": match.home_team,
            "away_team": match.away_team,
            "source_url": match.source_url,
            "status": match.status,
            "home_score": None if match.home_score == NO_SCORE else match.home_score,
            "away_score": None if match.away_score == NO_SCORE else match.away_score,
            "last_checked_at": match.last_checked_at,
        }

    @gl.public.view
    def is_operator(self, address: str) -> bool:
        addr = Address(address)
        return addr == self.owner or addr in self.operators
