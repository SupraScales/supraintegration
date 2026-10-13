from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from skyshare_scrapling.cli import load_config
from skyshare_scrapling.models import DiscoveryItem
from skyshare_scrapling.sink import SupabaseInboxSink


def test_checked_in_allowlist_has_seven_unique_official_domains() -> None:
    config = Path(__file__).parents[1] / "config" / "dealer-domains.json"
    domains = load_config(config)
    assert len(domains) == 7
    assert len({item.domain for item in domains}) == 7
    assert all(seed.startswith("https://") for item in domains for seed in item.seeds)


def test_inbox_source_key_is_stable_for_the_canonical_url() -> None:
    discovery = DiscoveryItem(
        source_domain="example.com",
        canonical_url="https://example.com/news/acquisition",
        source_type="official_dealer_event",
        page_title="Acquisition",
        event_date="2026-09-15",
        content_hash="a" * 64,
        relevant_text="Example Motors completed its acquisition.",
        relationship_links=("https://example.com/team",),
        fetch_method="scrapling_http",
        http_status=200,
        fetched_at=datetime(2026, 9, 29, tzinfo=UTC).isoformat(),
    )
    sink = SupabaseInboxSink("https://project.supabase.co", "secret", "org", "hunt")
    first = sink._row(discovery)
    second = sink._row(discovery)
    assert first["source_key"] == second["source_key"]
    assert first["form_type"] == "PUBLIC_WEB"
    assert first["metadata"] == discovery.as_dict()
