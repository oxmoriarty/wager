"""
Direct-mode tests for MatchMonitoring.

Run with: pytest genlayer/tests -v
See test_fixture_discovery.py's module docstring for why SDK_VERSION is
pinned explicitly.
"""

import json

SDK_VERSION = "v0.2.16"
CONTRACT_PATH = "contracts/match_monitoring.py"

FIXTURE_ID = "premier-league-arsenal-chelsea-2026-08-01t15-00-00-00-00"


def _llm_response(status: str, home_score=None, away_score=None) -> str:
    return json.dumps(
        {"status": status, "home_score": home_score, "away_score": away_score}
    )


def _deploy(direct_vm, direct_deploy, status="SCHEDULED", home_score=None, away_score=None):
    direct_vm.mock_web(r".*", {"status": 200, "body": "<html>match page</html>"})
    direct_vm.mock_llm(r".*", _llm_response(status, home_score, away_score))
    return direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)


def _check(contract, fixture_id=FIXTURE_ID):
    return contract.check_match(fixture_id, "Arsenal", "Chelsea", "https://example.com/match")


class TestAccessControl:
    def test_deployer_is_owner_and_operator(self, direct_vm, direct_deploy, direct_owner):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.is_operator(direct_owner) is True

    def test_non_operator_cannot_check_match(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.prank(direct_alice):
            with direct_vm.expect_revert("operator"):
                _check(contract)

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


class TestStatusAndScoreTracking:
    def test_scheduled_match_has_no_score(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy, status="SCHEDULED")
        result = _check(contract)

        assert result["status"] == "SCHEDULED"
        assert result["home_score"] is None
        assert result["away_score"] is None

    def test_live_match_stores_current_score(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy, status="LIVE", home_score=1, away_score=0)
        result = _check(contract)

        assert result["status"] == "LIVE"
        assert result["home_score"] == 1
        assert result["away_score"] == 0

    def test_zero_zero_score_is_distinct_from_no_score(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy, status="LIVE", home_score=0, away_score=0)
        result = _check(contract)

        assert result["home_score"] == 0
        assert result["away_score"] == 0
        assert result["home_score"] is not None

    def test_finished_match_stores_final_score(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, status="FINISHED", home_score=3, away_score=2
        )
        result = _check(contract)

        assert result["status"] == "FINISHED"
        assert result["home_score"] == 3
        assert result["away_score"] == 2

    def test_postponed_match_detected(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy, status="POSTPONED")
        result = _check(contract)
        assert result["status"] == "POSTPONED"

    def test_suspended_match_detected(self, direct_vm, direct_deploy):
        contract = _deploy(
            direct_vm, direct_deploy, status="SUSPENDED", home_score=1, away_score=1
        )
        result = _check(contract)
        assert result["status"] == "SUSPENDED"
        assert result["home_score"] == 1

    def test_abandoned_match_detected(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy, status="ABANDONED")
        result = _check(contract)
        assert result["status"] == "ABANDONED"

    def test_canceled_match_detected(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy, status="CANCELED")
        result = _check(contract)
        assert result["status"] == "CANCELED"

    def test_rechecking_overwrites_previous_state(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy, status="SCHEDULED")
        _check(contract)

        # Match kicks off — recheck with fresh mocks reflecting LIVE state.
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", _llm_response("LIVE", 1, 0))
        result = _check(contract)

        assert result["status"] == "LIVE"
        stored = contract.get_match_state(FIXTURE_ID)
        assert stored["status"] == "LIVE"
        assert stored["home_score"] == 1

    def test_get_match_state_for_unknown_fixture_returns_empty_dict(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.get_match_state("does-not-exist") == {}

    def test_monitored_fixture_ids_tracks_checked_matches(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.get_monitored_fixture_ids() == []

        _check(contract)
        assert contract.get_monitored_fixture_ids() == [FIXTURE_ID]

        # Rechecking the same fixture must not duplicate the id.
        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", _llm_response("LIVE", 0, 0))
        _check(contract)
        assert contract.get_monitored_fixture_ids() == [FIXTURE_ID]

    def test_rejects_empty_fixture_id(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("fixture_id"):
            contract.check_match("", "Arsenal", "Chelsea", "https://example.com")

    def test_rejects_empty_team_names(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("team"):
            contract.check_match(FIXTURE_ID, "", "Chelsea", "https://example.com")

    def test_rejects_empty_source_url(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("source_url"):
            contract.check_match(FIXTURE_ID, "Arsenal", "Chelsea", "")


class TestValidatorConsensus:
    def test_validator_agrees_on_identical_extraction(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(
            direct_vm, direct_deploy, status="LIVE", home_score=2, away_score=1
        )
        _check(contract)
        assert direct_vm.run_validator() is True

    def test_validator_agrees_when_both_see_no_score(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy, status="SCHEDULED")
        _check(contract)
        assert direct_vm.run_validator() is True

    def test_validator_disagrees_on_different_score(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(
            direct_vm, direct_deploy, status="LIVE", home_score=1, away_score=0
        )
        _check(contract)

        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", _llm_response("LIVE", 2, 0))

        assert direct_vm.run_validator() is False

    def test_validator_disagrees_on_different_status(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy, status="LIVE", home_score=0, away_score=0)
        _check(contract)

        direct_vm.clear_mocks()
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", _llm_response("FINISHED", 0, 0))

        assert direct_vm.run_validator() is False

    def test_validator_disagrees_when_leader_errored(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy, status="LIVE", home_score=1, away_score=1)
        _check(contract)

        assert (
            direct_vm.run_validator(leader_error=Exception("source unreachable"))
            is False
        )

    def test_validator_disagrees_on_malformed_leader_result(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy, status="LIVE", home_score=1, away_score=1)
        _check(contract)

        assert (
            direct_vm.run_validator(leader_result={"unexpected": "shape"}) is False
        )

    def test_invalid_status_from_llm_causes_leader_error(
        self, direct_vm, direct_deploy
    ):
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", json.dumps({"status": "NOT_A_REAL_STATUS"}))
        contract = direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)

        with direct_vm.expect_revert():
            _check(contract)

    def test_non_integer_score_from_llm_causes_leader_error(
        self, direct_vm, direct_deploy
    ):
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(
            r".*",
            json.dumps({"status": "LIVE", "home_score": "many", "away_score": 0}),
        )
        contract = direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)

        with direct_vm.expect_revert():
            _check(contract)
