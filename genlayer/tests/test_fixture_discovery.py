"""
Direct-mode tests for FixtureDiscovery.

Run with: pytest genlayer/tests -v
(from the repo's genlayer/ directory, with genlayer-test installed)

Note on SDK_VERSION: genlayer-test's auto-resolved "latest" version
currently 404s, because the upstream `genlayerlabs/genvm` repository was
renamed to `genlayerlabs/genvm-manager` and the installed genlayer-test
(0.29.2) still points its release-asset URL at the old repo name. Its
own hardcoded fallback (and what `genvm-lint` itself resolves to) is
v0.2.16, which does have a working release asset — pinned explicitly
here so tests aren't blocked on that upstream package staleness. Remove
this pin once genlayer-test ships a fix.
"""

import json

SDK_VERSION = "v0.2.16"
CONTRACT_PATH = "contracts/fixture_discovery.py"

SAMPLE_LLM_RESPONSE = json.dumps(
    {
        "fixtures": [
            {
                "home_team": "Arsenal",
                "away_team": "Chelsea",
                "kickoff_iso": "2026-08-01T15:00:00+00:00",
            },
            {
                "home_team": "Liverpool",
                "away_team": "Manchester City",
                "kickoff_iso": "2026-08-02T17:30:00+00:00",
            },
        ]
    }
)

EMPTY_LLM_RESPONSE = json.dumps({"fixtures": []})


def _deploy(direct_vm, direct_deploy, mock_web_body="<html>fixtures page</html>"):
    direct_vm.mock_web(r".*", {"status": 200, "body": mock_web_body})
    direct_vm.mock_llm(r".*", SAMPLE_LLM_RESPONSE)
    return direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)


class TestDeploymentAndAccessControl:
    def test_deployer_is_owner_and_operator(self, direct_vm, direct_deploy, direct_owner):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.is_operator(direct_owner) is True

    def test_non_operator_cannot_discover_fixtures(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)

        with direct_vm.prank(direct_alice):
            with direct_vm.expect_revert("operator"):
                contract.discover_fixtures("Premier League", "https://example.com")

    def test_owner_can_add_operator(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.add_operator(direct_alice)
        assert contract.is_operator(direct_alice) is True

    def test_non_owner_cannot_add_operator(
        self, direct_vm, direct_deploy, direct_alice, direct_bob
    ):
        contract = _deploy(direct_vm, direct_deploy)

        with direct_vm.prank(direct_alice):
            with direct_vm.expect_revert("owner"):
                contract.add_operator(direct_bob)

    def test_owner_can_remove_operator(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.add_operator(direct_alice)
        assert contract.is_operator(direct_alice) is True

        contract.remove_operator(direct_alice)
        assert contract.is_operator(direct_alice) is False

    def test_added_operator_can_discover_fixtures(
        self, direct_vm, direct_deploy, direct_alice
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.add_operator(direct_alice)

        with direct_vm.prank(direct_alice):
            created = contract.discover_fixtures(
                "Premier League", "https://example.com/fixtures"
            )
        assert created == 2


class TestFixtureDiscovery:
    def test_discovers_and_stores_fixtures(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)

        created = contract.discover_fixtures(
            "Premier League", "https://example.com/fixtures"
        )

        assert created == 2
        assert contract.get_fixture_count() == 2

        fixture_ids = contract.get_fixture_ids()
        assert len(fixture_ids) == 2

        fixture = contract.get_fixture(fixture_ids[0])
        assert fixture["competition"] == "Premier League"
        assert fixture["home_team"] == "Arsenal"
        assert fixture["away_team"] == "Chelsea"
        assert fixture["status"] == "SCHEDULED"

    def test_creates_one_canonical_market_per_fixture(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.discover_fixtures("Premier League", "https://example.com/fixtures")

        market_ids = contract.get_market_ids()
        assert len(market_ids) == 2

        market = contract.get_market(market_ids[0])
        assert market["market_type"] == "MATCH_RESULT"
        assert market["status"] == "OPEN"
        assert market["fixture_id"] in contract.get_fixture_ids()

    def test_rerunning_discovery_does_not_duplicate_fixtures(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)

        first = contract.discover_fixtures(
            "Premier League", "https://example.com/fixtures"
        )
        second = contract.discover_fixtures(
            "Premier League", "https://example.com/fixtures"
        )

        assert first == 2
        assert second == 0  # identical fixtures already known — no dupes
        assert contract.get_fixture_count() == 2

    def test_empty_extraction_creates_nothing(self, direct_vm, direct_deploy):
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", EMPTY_LLM_RESPONSE)
        contract = direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)

        created = contract.discover_fixtures(
            "Premier League", "https://example.com/fixtures"
        )
        assert created == 0
        assert contract.get_fixture_count() == 0

    def test_rejects_empty_competition(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("competition"):
            contract.discover_fixtures("", "https://example.com/fixtures")

    def test_rejects_empty_source_url(self, direct_vm, direct_deploy):
        contract = _deploy(direct_vm, direct_deploy)
        with direct_vm.expect_revert("source_url"):
            contract.discover_fixtures("Premier League", "")

    def test_unknown_fixture_lookup_returns_empty_dict(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.get_fixture("does-not-exist") == {}

    def test_unknown_market_lookup_returns_empty_dict(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        assert contract.get_market("does-not-exist") == {}

    def test_partial_fixture_missing_kickoff_is_skipped(
        self, direct_vm, direct_deploy
    ):
        response = json.dumps(
            {
                "fixtures": [
                    {"home_team": "Arsenal", "away_team": "Chelsea", "kickoff_iso": ""},
                    {
                        "home_team": "Liverpool",
                        "away_team": "Man City",
                        "kickoff_iso": "2026-08-02T17:30:00+00:00",
                    },
                ]
            }
        )
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", response)
        contract = direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)

        created = contract.discover_fixtures(
            "Premier League", "https://example.com/fixtures"
        )
        # Only the fixture with a real kickoff time should be stored.
        assert created == 1


class TestValidatorConsensus:
    def test_validator_agrees_when_leader_and_validator_extract_same_fixtures(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.discover_fixtures("Premier League", "https://example.com/fixtures")

        # Same mocks are still active, so the validator's independent
        # extraction reproduces an identical fixture set -> should agree.
        assert direct_vm.run_validator() is True

    def test_validator_disagrees_on_completely_different_fixture_set(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.discover_fixtures("Premier League", "https://example.com/fixtures")

        # Swap mocks to simulate the validator's LLM extracting a totally
        # different, non-overlapping set of fixtures.
        direct_vm.clear_mocks()
        different_response = json.dumps(
            {
                "fixtures": [
                    {
                        "home_team": "Real Madrid",
                        "away_team": "Barcelona",
                        "kickoff_iso": "2026-09-01T20:00:00+00:00",
                    }
                ]
            }
        )
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", different_response)

        assert direct_vm.run_validator() is False

    def test_validator_disagrees_when_leader_result_is_malformed(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.discover_fixtures("Premier League", "https://example.com/fixtures")

        assert (
            direct_vm.run_validator(leader_result={"not": "the expected shape"})
            is False
        )

    def test_validator_disagrees_when_leader_errored(
        self, direct_vm, direct_deploy
    ):
        contract = _deploy(direct_vm, direct_deploy)
        contract.discover_fixtures("Premier League", "https://example.com/fixtures")

        assert (
            direct_vm.run_validator(leader_error=Exception("source unreachable"))
            is False
        )

    def test_validator_agrees_when_both_find_zero_fixtures(
        self, direct_vm, direct_deploy
    ):
        direct_vm.mock_web(r".*", {"status": 200, "body": "<html></html>"})
        direct_vm.mock_llm(r".*", EMPTY_LLM_RESPONSE)
        contract = direct_deploy(CONTRACT_PATH, sdk_version=SDK_VERSION)
        contract.discover_fixtures("Premier League", "https://example.com/fixtures")

        assert direct_vm.run_validator() is True
