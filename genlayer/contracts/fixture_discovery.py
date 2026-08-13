# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Wager — Fixture Discovery Intelligent Contract.

Responsibilities (PROJECT.md §6):
  - Discover fixtures from a trusted source
  - Validate fixtures
  - Create canonical markets

Per PROJECT.md §6's governing principle, this contract owns all
non-deterministic reasoning involved in fixture discovery (fetching a
web source and extracting structured fixture data via an LLM). Wager's
backend only ever reads the validated results below and syncs them into
its own database — it never independently decides what a "fixture" is.

Deployment target: GenLayer Bradbury Testnet.
"""

from genlayer import *
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import typing

MATCH_RESULT = "MATCH_RESULT"

# Consensus is accepted if independent validator extraction overlaps the
# leader's by at least this fraction (Jaccard similarity over the set of
# (home, away, kickoff) tuples). See `validator_fn` in `discover_fixtures`.
MIN_FIXTURE_SET_SIMILARITY = 0.8

# Web content is truncated before being embedded in the LLM prompt to keep
# prompts bounded regardless of source page size.
MAX_PAGE_CHARS = 15000


@allow_storage
@dataclass
class Fixture:
    fixture_id: str
    competition: str
    home_team: str
    away_team: str
    kickoff_iso: str
    status: str
    source_url: str
    discovered_at: str


@allow_storage
@dataclass
class Market:
    market_id: str
    fixture_id: str
    market_type: str
    status: str
    created_at: str


class FixtureDiscovery(gl.Contract):
    owner: Address
    operators: DynArray[Address]
    fixtures: TreeMap[str, Fixture]
    fixture_ids: DynArray[str]
    markets: TreeMap[str, Market]
    market_ids: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.operators.append(gl.message.sender_address)

    # ------------------------------------------------------------------
    # Access control
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
            "Only an authorized operator can trigger fixture discovery"
        )

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    @gl.public.write
    def discover_fixtures(self, competition: str, source_url: str) -> u32:
        """
        Fetches `source_url`, extracts upcoming fixtures for `competition`
        via LLM, reaches validator consensus on the extracted set, then
        stores every fixture not already known and opens a canonical
        MATCH_RESULT market for each one.

        Returns the number of newly created fixtures.
        """
        self._require_operator()

        competition = competition.strip()
        source_url = source_url.strip()
        if not competition:
            raise gl.vm.UserError("competition must not be empty")
        if not source_url:
            raise gl.vm.UserError("source_url must not be empty")

        def leader_fn():
            page_text = gl.nondet.web.render(
                source_url, mode="text", wait_after_loaded="3s"
            )
            page_text = page_text[:MAX_PAGE_CHARS]

            prompt = f"""You are extracting upcoming football fixtures for the
competition "{competition}" from the web page content below.

Web page content:
{page_text}

Extract every upcoming (not yet played/finished) fixture you can find
for this competition. For each fixture, provide:
- home_team: the home team's official name, trimmed, no extra whitespace
- away_team: the away team's official name, trimmed, no extra whitespace
- kickoff_iso: kickoff date and time in ISO 8601 format (UTC), or an
  empty string if you cannot determine it confidently

Only include fixtures you are confident about. If you cannot confidently
identify any fixtures, return an empty list rather than guessing.

Respond using ONLY the following JSON format, nothing else:
{{
    "fixtures": [
        {{"home_team": "...", "away_team": "...", "kickoff_iso": "..."}}
    ]
}}
"""
            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(result, dict) or not isinstance(
                result.get("fixtures"), list
            ):
                raise gl.vm.UserError(
                    "LLM did not return the expected {fixtures: [...]} structure"
                )
            return result

        def normalize(entry: dict) -> tuple[str, str, str]:
            home = str(entry.get("home_team", "")).strip().lower()
            away = str(entry.get("away_team", "")).strip().lower()
            kickoff = str(entry.get("kickoff_iso", "")).strip()
            return (home, away, kickoff)

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                # Leader errored (unreachable source, malformed LLM output,
                # etc). Disagree so the network rotates to a new leader,
                # rather than agreeing on a broken/empty result.
                return False

            leader_data = leaders_res.calldata
            if not isinstance(leader_data, dict) or not isinstance(
                leader_data.get("fixtures"), list
            ):
                return False

            my_result = leader_fn()

            leader_set = {normalize(f) for f in leader_data["fixtures"]}
            my_set = {normalize(f) for f in my_result["fixtures"]}

            if len(leader_set) == 0 and len(my_set) == 0:
                return True
            if len(leader_set) == 0 or len(my_set) == 0:
                return False

            overlap = leader_set & my_set
            union = leader_set | my_set
            similarity = len(overlap) / len(union)
            return similarity >= MIN_FIXTURE_SET_SIMILARITY

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        created_count = 0
        now_iso = datetime.now(timezone.utc).isoformat()

        for raw in result["fixtures"]:
            home = str(raw.get("home_team", "")).strip()
            away = str(raw.get("away_team", "")).strip()
            kickoff = str(raw.get("kickoff_iso", "")).strip()

            if not home or not away or not kickoff:
                continue

            fixture_id = self._make_fixture_id(competition, home, away, kickoff)
            if fixture_id in self.fixtures:
                continue

            self.fixtures[fixture_id] = Fixture(
                fixture_id=fixture_id,
                competition=competition,
                home_team=home,
                away_team=away,
                kickoff_iso=kickoff,
                status="SCHEDULED",
                source_url=source_url,
                discovered_at=now_iso,
            )
            self.fixture_ids.append(fixture_id)
            created_count += 1

            market_id = f"{fixture_id}:{MATCH_RESULT}"
            self.markets[market_id] = Market(
                market_id=market_id,
                fixture_id=fixture_id,
                market_type=MATCH_RESULT,
                status="OPEN",
                created_at=now_iso,
            )
            self.market_ids.append(market_id)

        return u32(created_count)

    def _make_fixture_id(
        self, competition: str, home: str, away: str, kickoff_iso: str
    ) -> str:
        raw = f"{competition}|{home}|{away}|{kickoff_iso}".lower().strip()
        return "-".join(raw.split())

    # ------------------------------------------------------------------
    # Read methods (consumed by Wager's backend sync job)
    # ------------------------------------------------------------------

    @gl.public.view
    def get_fixture_ids(self) -> list[str]:
        return [fid for fid in self.fixture_ids]

    @gl.public.view
    def get_fixture_count(self) -> u32:
        return u32(len(self.fixture_ids))

    @gl.public.view
    def get_fixture(self, fixture_id: str) -> dict[str, typing.Any]:
        fixture = self.fixtures.get(fixture_id, None)
        if fixture is None:
            return {}
        return {
            "fixture_id": fixture.fixture_id,
            "competition": fixture.competition,
            "home_team": fixture.home_team,
            "away_team": fixture.away_team,
            "kickoff_iso": fixture.kickoff_iso,
            "status": fixture.status,
            "source_url": fixture.source_url,
            "discovered_at": fixture.discovered_at,
        }

    @gl.public.view
    def get_market_ids(self) -> list[str]:
        return [mid for mid in self.market_ids]

    @gl.public.view
    def get_market(self, market_id: str) -> dict[str, typing.Any]:
        market = self.markets.get(market_id, None)
        if market is None:
            return {}
        return {
            "market_id": market.market_id,
            "fixture_id": market.fixture_id,
            "market_type": market.market_type,
            "status": market.status,
            "created_at": market.created_at,
        }

    @gl.public.view
    def is_operator(self, address: str) -> bool:
        addr = Address(address)
        return addr == self.owner or addr in self.operators
