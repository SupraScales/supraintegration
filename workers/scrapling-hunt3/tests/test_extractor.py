from __future__ import annotations

from datetime import UTC, datetime

from scrapling.parser import Selector

from skyshare_scrapling.extractor import normalize_page

EVENT_HTML = """
<html><head><title>Example Motors completes acquisition</title>
<meta property="article:published_time" content="2026-09-15T12:00:00Z"></head>
<body><main><h1>Example Motors completed its acquisition</h1>
<p>Example Motors acquired two dealerships in Denver, Colorado and Phoenix, Arizona.</p>
<a href="/leadership?utm_source=news">Leadership team</a></main></body></html>
"""

OWNER_HTML = """
<html><head><title>Leadership | Example Motors</title></head>
<body><main><p>Alex Example, Founder and CEO, owns Example Motors.</p></main></body></html>
"""


def item(html: str, url: str):
    return normalize_page(
        page=Selector(html, url=url),
        url=url,
        allowlisted_domain="example.com",
        status=200,
        fetched_at=datetime(2026, 9, 29, tzinfo=UTC),
    )


def test_event_page_is_normalized_with_stable_hash_and_relationship() -> None:
    first = item(EVENT_HTML, "https://example.com/news/acquisition")
    second = item(EVENT_HTML, "https://example.com/news/acquisition#ignored")
    assert first is not None and second is not None
    assert first.source_type == "official_dealer_event"
    assert first.event_date == "2026-09-15"
    assert first.content_hash == second.content_hash
    assert first.canonical_url == second.canonical_url
    assert first.relationship_links == ("https://example.com/leadership",)


def test_ownership_page_is_discovered_without_changing_hunt_semantics() -> None:
    ownership = item(OWNER_HTML, "https://example.com/leadership")
    assert ownership is not None
    assert ownership.source_type == "official_dealer_ownership"
    assert "Founder and CEO" in ownership.relevant_text


def test_irrelevant_page_is_not_emitted() -> None:
    assert item("<html><body>Service coupons</body></html>", "https://example.com/service") is None
