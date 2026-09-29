from __future__ import annotations

import asyncio
import socket
from dataclasses import dataclass

from skyshare_scrapling.models import DomainConfig, RunCounters
from skyshare_scrapling.worker import DomainCrawler


@dataclass
class Response:
    status: int
    headers: dict[str, str]
    body: bytes
    url: str


def public_resolver(*_args: object, **_kwargs: object):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))]


def fixture_fetcher(fail_team: bool = False):
    pages = {
        "https://example.com/robots.txt": Response(
            200, {"content-type": "text/plain"}, b"User-agent: *\nAllow: /\n", "https://example.com/robots.txt"
        ),
        "https://example.com/": Response(
            200,
            {"content-type": "text/html"},
            b'<html><body><a href="/news/acquisition">News</a><a href="https://evil.test/team">Offsite</a></body></html>',
            "https://example.com/",
        ),
        "https://example.com/news/acquisition": Response(
            200,
            {"content-type": "text/html"},
            (
                b'<html><head><title>Acquisition news</title></head><body>'
                b'Example Motors completed its acquisition on 2026-09-15.'
                b'<a href="/team">Team</a>'
                b'<a href="/news/acquisition">Duplicate</a></body></html>'
            ),
            "https://example.com/news/acquisition",
        ),
        "https://example.com/team": Response(
            200,
            {"content-type": "text/html"},
            (
                b"<html><head><title>Leadership team</title></head><body>"
                b"Alex Example, Founder and CEO, owns Example Motors.</body></html>"
            ),
            "https://example.com/team",
        ),
    }

    async def fetch(url: str) -> Response:
        if fail_team and url.endswith("/team"):
            raise OSError("fixture transport failure")
        return pages[url]

    return fetch


def crawl(fetcher=None):
    crawler = DomainCrawler(
        DomainConfig("Example Motors", "example.com", ("https://example.com/",)),
        fetcher=fetcher or fixture_fetcher(),
        request_delay_seconds=0,
        retries=0,
        resolver=public_resolver,
    )
    counters = RunCounters(domains_configured=1)
    return asyncio.run(crawler.crawl(counters)), counters


def test_crawl_stays_on_allowlist_discovers_event_and_team_and_dedupes() -> None:
    items, counters = crawl()
    assert {item.canonical_url for item in items} == {
        "https://example.com/news/acquisition",
        "https://example.com/team",
    }
    assert counters.event_pages == 1
    assert counters.ownership_pages == 1
    assert counters.pages_fetched == 3
    assert all("evil.test" not in item.canonical_url for item in items)


def test_rerun_has_stable_discovery_keys() -> None:
    first, _ = crawl()
    second, _ = crawl()
    assert [(item.canonical_url, item.content_hash) for item in first] == [
        (item.canonical_url, item.content_hash) for item in second
    ]


def test_fetch_failure_is_counted_without_emitting_false_evidence() -> None:
    items, counters = crawl(fixture_fetcher(fail_team=True))
    assert [item.canonical_url for item in items] == ["https://example.com/news/acquisition"]
    assert counters.failed == 1


def test_redirect_escape_fails_closed() -> None:
    async def redirecting(url: str) -> Response:
        if url.endswith("robots.txt"):
            return Response(200, {"content-type": "text/plain"}, b"User-agent: *\nAllow: /", url)
        return Response(302, {"location": "https://evil.test/internal"}, b"", url)

    items, counters = crawl(redirecting)
    assert items == []
    assert counters.failed == 1


def test_oversized_response_fails_without_emitting_evidence() -> None:
    async def oversized(url: str) -> Response:
        if url.endswith("robots.txt"):
            return Response(200, {"content-type": "text/plain"}, b"User-agent: *\nAllow: /", url)
        return Response(200, {"content-type": "text/html"}, b"x" * 129, url)

    crawler = DomainCrawler(
        DomainConfig("Example Motors", "example.com", ("https://example.com/news",)),
        fetcher=oversized,
        request_delay_seconds=0,
        retries=0,
        max_response_bytes=128,
        resolver=public_resolver,
    )
    counters = RunCounters(domains_configured=1)
    assert asyncio.run(crawler.crawl(counters)) == []
    assert counters.failed == 1


def test_robots_disallow_prevents_page_fetch() -> None:
    requested: list[str] = []

    async def robots_denied(url: str) -> Response:
        requested.append(url)
        return Response(
            200,
            {"content-type": "text/plain"},
            b"User-agent: *\nDisallow: /news\n",
            url,
        )

    crawler = DomainCrawler(
        DomainConfig("Example Motors", "example.com", ("https://example.com/news",)),
        fetcher=robots_denied,
        request_delay_seconds=0,
        retries=0,
        resolver=public_resolver,
    )
    counters = RunCounters(domains_configured=1)
    assert asyncio.run(crawler.crawl(counters)) == []
    assert requested == ["https://example.com/robots.txt"]
    assert counters.robots_denied == 1
