"""
Direct-mode tests for Settlement.

Run with: pytest genlayer/tests -v
See test_fixture_discovery.py's module docstring for why SDK_VERSION is
pinned explicitly.
"""

import json

SDK_VERSION = "v0.2.16"
CONTRACT_PATH = "contracts/settlement.py"

FIXTURE_ID = "premier-league-arsenal-chelsea-2026-08-01t15-00-00-00-00"


def _llm_response(confirmed: bool, home_score=None, away_score=None, reason=""):
    return json.dumps(
        {
            "confirmed": confirmed,
            "found_home_score": home_score,
            "found_away_score": away_score,
            "reason": reason,
        }
    )


def _deploy(
    direct_vm,
    direct_deploy,
    confirmed=True,
    home_score=2,
    away_score=1,
    reason="Score confirmed",
):
    direct_vm.mock_web(
        r".*", {"status": 200, "body": "<html>match result page</html>"}
    )
    direct_vm.mock_llm(
        r".*", _llm_response(confirmed, home_score, away_score, reason)
    )
    return direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)


def _settle(
    contract,
    fixture_id=FIXTURE_ID,
    home_team="Arsenal",
    away_team="Chelsea",
    match_status="FINISHED",
    home_score=2,
    away_score=1,
    source_urls="https://example.com/results,https://backup.com/results",
):
    return contract.settle_market(
        fixture_id,
        home_team,
        away_team,
        match_status,
        home_score,
        away_score,
        source_urls,
    )


# ======================================================================
# Access Control
# ======================================================================


class TestAccessControl:
    def test_deployer_is_owner_and_operator(
        self, direct_vm, direct_deploy, direct_owner
    ):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.is_operator(direct_owner) is True

    def test_non_operator_cannot_settle(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.prank(direct_alice):
            with direct_vm.expect_revert("operator"):
                _settle(contract)

    def test_owner_can_add_and_remove_operator(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.add_operator(direct_alice)
        assert contract.is_operator(direct_alice) is True

        contract.remove_operator(direct_alice)
        assert contract.is_operator(direct_alice) is False

    def test_non_owner_cannot_add_operator(
        self, direct_vm, direct_deploy, direct_alice, direct_bob
    ):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.prank(direct_alice):
            with direct_vm.expect_revert("owner"):
                contract.add_operator(direct_bob)

    def test_added_operator_can_settle(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.add_operator(direct_alice)

        with direct_vm.prank(direct_alice):
            result = _settle(contract)
        assert result["outcome"] == "SUPPORT"


# ======================================================================
# Settlement Decisions
# ======================================================================


class TestSettlementDecisions:
    def test_home_win_settles_as_support(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=2, away_score=1
        )
        result = _settle(contract, home_score=2, away_score=1)

        assert result["outcome"] == "SUPPORT"
        assert result["confidence"] >= 0.8
        assert "Home win" in result["summary"]

    def test_away_win_settles_as_challenge(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=0, away_score=3
        )
        result = _settle(contract, home_score=0, away_score=3)

        assert result["outcome"] == "CHALLENGE"
        assert result["confidence"] >= 0.8
        assert "Away win" in result["summary"]

    def test_draw_settles_as_void(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=1, away_score=1
        )
        result = _settle(contract, home_score=1, away_score=1)

        assert result["outcome"] == "VOID"
        assert "Draw" in result["summary"]

    def test_nil_nil_draw_settles_as_void(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=0, away_score=0
        )
        result = _settle(contract, home_score=0, away_score=0)

        assert result["outcome"] == "VOID"
        assert "Draw" in result["summary"]

    def test_postponed_match_voids_immediately(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        result = _settle(contract, match_status="POSTPONED", source_urls="")

        assert result["outcome"] == "VOID"
        assert result["confidence"] == 1.0
        assert "POSTPONED" in result["summary"]
        assert result["sources_checked"] == 0

    def test_abandoned_match_voids_immediately(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        result = _settle(contract, match_status="ABANDONED", source_urls="")

        assert result["outcome"] == "VOID"
        assert "ABANDONED" in result["summary"]

    def test_canceled_match_voids_immediately(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        result = _settle(contract, match_status="CANCELED", source_urls="")

        assert result["outcome"] == "VOID"

    def test_suspended_match_voids_immediately(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        result = _settle(contract, match_status="SUSPENDED", source_urls="")

        assert result["outcome"] == "VOID"
        assert "SUSPENDED" in result["summary"]

    def test_low_confidence_voids(self, direct_vm, direct_deploy):
        """When sources don't confirm the score, confidence is low → VOID."""
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=False, home_score=None, away_score=None
        )
        result = _settle(contract, home_score=2, away_score=1)

        assert result["outcome"] == "VOID"
        assert result["confidence"] < 0.8
        assert "Insufficient" in result["summary"]


# ======================================================================
# Storage & Read Methods
# ======================================================================


class TestStorageAndReads:
    def test_settlement_is_stored_and_readable(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        _settle(contract)

        stored = contract.get_settlement(FIXTURE_ID)
        assert stored["fixture_id"] == FIXTURE_ID
        assert stored["market_type"] == "MATCH_RESULT"
        assert stored["outcome"] == "SUPPORT"
        assert stored["home_score"] == 2
        assert stored["away_score"] == 1
        assert stored["settled_at"] != ""

    def test_unknown_fixture_returns_empty_dict(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.get_settlement("does-not-exist") == {}

    def test_settlement_ids_tracks_settled_fixtures(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.get_settlement_ids() == []

        _settle(contract)
        assert contract.get_settlement_ids() == [FIXTURE_ID]

    def test_resettling_same_fixture_overwrites(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=2, away_score=1
        )
        _settle(contract, home_score=2, away_score=1)

        # Re-settle with different score
        direct_vm.clear_mocks()
        direct_vm.mock_web(
            r".*", {"status": 200, "body": "<html>updated page</html>"}
        )
        direct_vm.mock_llm(
            r".*", _llm_response(True, 3, 1, "Updated score")
        )
        _settle(contract, home_score=3, away_score=1)

        stored = contract.get_settlement(FIXTURE_ID)
        assert stored["home_score"] == 3
        assert stored["away_score"] == 1
        # No duplicate IDs
        assert contract.get_settlement_ids() == [FIXTURE_ID]


# ======================================================================
# Input Validation
# ======================================================================


class TestInputValidation:
    def test_rejects_empty_fixture_id(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("fixture_id"):
            _settle(contract, fixture_id="")

    def test_rejects_empty_team_names(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("team"):
            _settle(contract, home_team="")

    def test_rejects_empty_source_urls_for_finished_match(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("source_urls"):
            _settle(contract, source_urls="")


# ======================================================================
# Validator Consensus
# ======================================================================


class TestValidatorConsensus:
    def test_validator_agrees_on_identical_outcome(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=2, away_score=1
        )
        _settle(contract, home_score=2, away_score=1)
        assert direct_vm.run_validator() is True

    def test_validator_agrees_on_void_status(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        _settle(contract, match_status="POSTPONED", source_urls="")
        # Void-status settlements don't use run_nondet_unsafe, so the
        # validator only runs for the normal-path settlements. This test
        # verifies the void path completes without error.
        assert contract.get_settlement(FIXTURE_ID)["outcome"] == "VOID"

    def test_validator_disagrees_on_different_outcome(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=2, away_score=1
        )
        _settle(contract, home_score=2, away_score=1)

        # Swap mocks so validator sees "not confirmed" → VOID, while
        # leader saw SUPPORT.
        direct_vm.clear_mocks()
        direct_vm.mock_web(
            r".*", {"status": 200, "body": "<html></html>"}
        )
        direct_vm.mock_llm(
            r".*", _llm_response(False, None, None, "Cannot confirm")
        )
        assert direct_vm.run_validator() is False

    def test_validator_disagrees_when_leader_errored(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=2, away_score=1
        )
        _settle(contract, home_score=2, away_score=1)

        assert (
            direct_vm.run_validator(leader_error=Exception("source unreachable"))
            is False
        )

    def test_validator_disagrees_on_malformed_leader_result(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(
            direct_vm, direct_deploy, confirmed=True, home_score=2, away_score=1
        )
        _settle(contract, home_score=2, away_score=1)

        assert (
            direct_vm.run_validator(leader_result={"unexpected": "shape"})
            is False
        )
