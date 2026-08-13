# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Wager — Settlement Intelligent Contract.

Responsibilities (PROJECT.md §6):
  - Verify match results from multiple trusted sources
  - Compare trusted sources for agreement
  - Produce settlement decisions with confidence scoring
  - Refuse uncertain settlement (confidence < 0.8)

Per PROJECT.md §6's governing principle, this contract owns the
non-deterministic reasoning involved in adjudicating a finished
match's outcome (fetching trusted sources, extracting results via LLM,
computing confidence from source agreement). Wager's backend only ever
reads the validated settlement decision below and relays it to the Arc
Escrow contract — it never independently decides what a market's
outcome is.

Settlement model: Draw No Bet.
  - Home win  → SUPPORT  (home-side stakers win the pot)
  - Away win  → CHALLENGE (away-side stakers win the pot)
  - Draw      → VOID     (all stakers get a full refund)

Edge cases (PROJECT.md §6):
  - Postponed/Abandoned/Canceled/Suspended → VOID
  - Extra time / penalties → ignored; MATCH_RESULT is decided on the
    full-time score (90 min + stoppage time) only
  - Conflicting sources → confidence drops below threshold → VOID

Deployment target: GenLayer Bradbury Testnet.
"""

from genlayer import *
from dataclasses import dataclass
from datetime import datetime, timezone
import typing

MATCH_RESULT = "MATCH_RESULT"

# Settlement is accepted only if confidence meets this threshold.
# Below this, the market is voided (full refund) rather than settled
# with a potentially incorrect outcome. (PROJECT.md §6: "Refuse
# uncertain settlement.")
MIN_CONFIDENCE = 0.8

# Valid outcomes. These map directly to Arc Escrow's Side enum and
# the Prisma Position/Market models.
VALID_OUTCOMES = {"SUPPORT", "CHALLENGE", "VOID"}

# Match statuses that should void a market rather than settle it.
VOID_STATUSES = {"POSTPONED", "SUSPENDED", "ABANDONED", "CANCELED"}

# Web content is truncated before being embedded in the LLM prompt.
MAX_PAGE_CHARS = 15000


@allow_storage
@dataclass
class SettlementRecord:
    fixture_id: str
    market_type: str
    outcome: str
    confidence: float
    summary: str
    home_score: i32
    away_score: i32
    sources_checked: u32
    sources_agreeing: u32
    settled_at: str


class Settlement(gl.Contract):
    owner: Address
    operators: DynArray[Address]
    settlements: TreeMap[str, SettlementRecord]
    settlement_ids: DynArray[str]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.operators.append(gl.message.sender_address)

    # ------------------------------------------------------------------
    # Access control (identical pattern to FixtureDiscovery and
    # MatchMonitoring — see those contracts for rationale)
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
            "Only an authorized operator can trigger settlement"
        )

    # ------------------------------------------------------------------
    # Settlement
    # ------------------------------------------------------------------

    @gl.public.write
    def settle_market(
        self,
        fixture_id: str,
        home_team: str,
        away_team: str,
        match_status: str,
        final_home_score: i32,
        final_away_score: i32,
        source_urls: str,
    ) -> dict[str, typing.Any]:
        """
        Adjudicates a MATCH_RESULT market for a finished (or
        void-eligible) match.

        The caller supplies the final score from the already-consensus'd
        Match Monitoring contract plus 1+ trusted source URLs (comma-
        separated). This contract independently verifies that result
        against those sources via LLM, computing a confidence score
        from the fraction of sources that agree.

        Settlement model (Draw No Bet):
          - Home win  → outcome "SUPPORT"
          - Away win  → outcome "CHALLENGE"
          - Draw      → outcome "VOID" (all stakers refunded)

        Matches that never finished normally (POSTPONED, SUSPENDED,
        ABANDONED, CANCELED) are immediately voided without fetching
        sources.

        Returns the settlement record dict and stores it on-chain.
        """
        self._require_operator()

        fixture_id = fixture_id.strip()
        home_team = home_team.strip()
        away_team = away_team.strip()
        match_status = match_status.strip().upper()
        source_urls = source_urls.strip()

        if not fixture_id:
            raise gl.vm.UserError("fixture_id must not be empty")
        if not home_team or not away_team:
            raise gl.vm.UserError("home_team and away_team must not be empty")
        if not source_urls and match_status not in VOID_STATUSES:
            raise gl.vm.UserError(
                "source_urls must not be empty for non-void settlements"
            )

        now_iso = datetime.now(timezone.utc).isoformat()

        # --- Fast path: void-eligible statuses ---
        if match_status in VOID_STATUSES:
            record = SettlementRecord(
                fixture_id=fixture_id,
                market_type=MATCH_RESULT,
                outcome="VOID",
                confidence=1.0,
                summary=f"Market voided: match status is {match_status}",
                home_score=final_home_score,
                away_score=final_away_score,
                sources_checked=u32(0),
                sources_agreeing=u32(0),
                settled_at=now_iso,
            )
            self._store(fixture_id, record)
            return self._to_dict(record)

        # --- Normal path: multi-source verification ---
        urls = [u.strip() for u in source_urls.split(",") if u.strip()]
        if len(urls) == 0:
            raise gl.vm.UserError("No valid source URLs provided")

        def leader_fn():
            agreeing = 0
            checked = 0

            for url in urls:
                checked += 1
                try:
                    page_text = gl.nondet.web.render(
                        url, mode="text", wait_after_loaded="3s"
                    )
                    page_text = page_text[:MAX_PAGE_CHARS]

                    prompt = f"""You are verifying the final result of a
football match by reading a web page.

Match: {home_team} vs {away_team}
Expected final score: {home_team} {final_home_score} - {final_away_score} {away_team}

Web page content:
{page_text}

Does this page confirm the exact final score above? Consider only the
full-time score (90 minutes + stoppage time). Ignore extra time,
penalty shootout results, and aggregate scores from multi-leg ties.

Respond using ONLY the following JSON format, nothing else:
{{
    "confirmed": true or false,
    "found_home_score": <integer or null>,
    "found_away_score": <integer or null>,
    "reason": "brief explanation"
}}
"""
                    result = gl.nondet.exec_prompt(
                        prompt, response_format="json"
                    )
                    if not isinstance(result, dict):
                        continue

                    confirmed = result.get("confirmed", False)
                    found_home = result.get("found_home_score")
                    found_away = result.get("found_away_score")

                    # Double-check: even if LLM says "confirmed", verify
                    # the extracted scores actually match
                    if confirmed and found_home is not None and found_away is not None:
                        try:
                            if int(found_home) == final_home_score and int(found_away) == final_away_score:
                                agreeing += 1
                        except (TypeError, ValueError):
                            pass
                    elif confirmed:
                        # LLM confirmed but didn't return scores — trust
                        # it only if the confirmation is explicit
                        agreeing += 1
                except Exception:
                    # Source unreachable or LLM error — skip this source,
                    # don't fail the entire settlement
                    pass

            confidence = agreeing / checked if checked > 0 else 0.0

            # Determine outcome from the verified score
            if confidence >= MIN_CONFIDENCE:
                if final_home_score > final_away_score:
                    outcome = "SUPPORT"
                elif final_away_score > final_home_score:
                    outcome = "CHALLENGE"
                else:
                    # Draw = VOID (Draw No Bet model)
                    outcome = "VOID"
            else:
                outcome = "VOID"

            summary_parts = []
            if outcome == "VOID" and confidence < MIN_CONFIDENCE:
                summary_parts.append(
                    f"Insufficient source agreement ({agreeing}/{checked})"
                )
            elif outcome == "VOID":
                summary_parts.append(
                    f"Draw ({final_home_score}-{final_away_score})"
                )
            elif outcome == "SUPPORT":
                summary_parts.append(
                    f"Home win ({home_team} {final_home_score}-{final_away_score} {away_team})"
                )
            else:
                summary_parts.append(
                    f"Away win ({home_team} {final_home_score}-{final_away_score} {away_team})"
                )
            summary_parts.append(
                f"Confidence: {confidence:.2f} ({agreeing}/{checked} sources)"
            )

            return {
                "outcome": outcome,
                "confidence": confidence,
                "summary": ". ".join(summary_parts),
                "sources_checked": checked,
                "sources_agreeing": agreeing,
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False

            leader_data = leaders_res.calldata
            if (
                not isinstance(leader_data, dict)
                or "outcome" not in leader_data
                or "confidence" not in leader_data
                or "sources_checked" not in leader_data
                or "sources_agreeing" not in leader_data
            ):
                return False

            try:
                my_result = leader_fn()
            except Exception:
                return False

            # Outcome is an objective decision derived from an objective
            # score — require exact match (same rationale as Match
            # Monitoring's exact-equality consensus).
            if my_result["outcome"] != leader_data["outcome"]:
                return False

            # Both must agree on whether confidence is above or below
            # the threshold. Minor floating-point differences in the
            # exact confidence value are acceptable, but the binary
            # settle-vs-void decision must agree.
            leader_above = leader_data["confidence"] >= MIN_CONFIDENCE
            my_above = my_result["confidence"] >= MIN_CONFIDENCE
            if leader_above != my_above:
                return False

            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        record = SettlementRecord(
            fixture_id=fixture_id,
            market_type=MATCH_RESULT,
            outcome=result["outcome"],
            confidence=result["confidence"],
            summary=result["summary"],
            home_score=final_home_score,
            away_score=final_away_score,
            sources_checked=u32(result["sources_checked"]),
            sources_agreeing=u32(result["sources_agreeing"]),
            settled_at=now_iso,
        )
        self._store(fixture_id, record)
        return self._to_dict(record)

    def _store(self, fixture_id: str, record: SettlementRecord) -> None:
        if fixture_id not in self.settlements:
            self.settlement_ids.append(fixture_id)
        self.settlements[fixture_id] = record

    def _to_dict(self, record: SettlementRecord) -> dict[str, typing.Any]:
        return {
            "fixture_id": record.fixture_id,
            "market_type": record.market_type,
            "outcome": record.outcome,
            "confidence": record.confidence,
            "summary": record.summary,
            "home_score": record.home_score,
            "away_score": record.away_score,
            "sources_checked": record.sources_checked,
            "sources_agreeing": record.sources_agreeing,
            "settled_at": record.settled_at,
        }

    # ------------------------------------------------------------------
    # Read methods (consumed by Wager's backend settlement sync job)
    # ------------------------------------------------------------------

    @gl.public.view
    def get_settlement_ids(self) -> list[str]:
        return [sid for sid in self.settlement_ids]

    @gl.public.view
    def get_settlement(self, fixture_id: str) -> dict[str, typing.Any]:
        record = self.settlements.get(fixture_id, None)
        if record is None:
            return {}
        return self._to_dict(record)

    @gl.public.view
    def is_operator(self, address: str) -> bool:
        addr = Address(address)
        return addr == self.owner or addr in self.operators
