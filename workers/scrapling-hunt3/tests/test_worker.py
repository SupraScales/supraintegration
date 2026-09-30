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


def partial_response(body: bytes, url: str, *, content_type: str = "text/html") -> Response:
    return Response(
        206,
        {
            "content-type": content_type,
            "content-range": f"bytes 0-{len(body) - 1}/{len(body)}",
        },
        body,
        url,
    )


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


def test_valid_byte_zero_partial_html_discovers_event_and_team_evidence() -> None:
    original = fixture_fetcher()

    async def partial_pages(url: str) -> Response:
        response = await original(url)
        if url.endswith("robots.txt"):
            return response
        return partial_response(response.body, response.url)

    items, counters = crawl(partial_pages)
    assert {item.canonical_url for item in items} == {
        "https://example.com/news/acquisition",
        "https://example.com/team",
    }
    assert counters.event_pages == 1
    assert counters.ownership_pages == 1
    assert counters.failed == 0


def test_partial_html_with_nonzero_start_is_rejected() -> None:
    async def nonzero_start(url: str) -> Response:
        if url.endswith("robots.txt"):
            return Response(200, {"content-type": "text/plain"}, b"User-agent: *\nAllow: /", url)
        body = b"<html><body>Example Motors completed its acquisition.</body></html>"
        return Response(
            206,
            {"content-type": "text/html", "content-range": f"bytes 1-{len(body)}/{len(body) + 1}"},
            body,
            url,
        )

    items, counters = crawl(nonzero_start)
    assert items == []
    assert counters.failed == 1


def test_partial_html_with_malformed_content_range_is_rejected() -> None:
    async def malformed(url: str) -> Response:
        if url.endswith("robots.txt"):
            return Response(200, {"content-type": "text/plain"}, b"User-agent: *\nAllow: /", url)
        return Response(
            206,
            {"content-type": "text/html", "content-range": "items 0-10/11"},
            b"hello world",
            url,
        )

    items, counters = crawl(malformed)
    assert items == []
    assert counters.failed == 1


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


def test_complete_partial_robots_is_parsed_and_enforced() -> None:
    requested: list[str] = []

    async def partial_robots(url: str) -> Response:
        requested.append(url)
        body = b"User-agent: *\nDisallow: /news\n"
        return partial_response(body, url, content_type="text/plain")

    crawler = DomainCrawler(
        DomainConfig("Example Motors", "example.com", ("https://example.com/news",)),
        fetcher=partial_robots,
        request_delay_seconds=0,
        retries=0,
        resolver=public_resolver,
    )
    counters = RunCounters(domains_configured=1)
    assert asyncio.run(crawler.crawl(counters)) == []
    assert requested == ["https://example.com/robots.txt"]
    assert counters.robots_denied == 1


def test_truncated_partial_robots_fails_closed() -> None:
    requested: list[str] = []

    async def truncated_robots(url: str) -> Response:
        requested.append(url)
        body = b"User-agent: *\nAllow: /\n"
        return Response(
            206,
            {
                "content-type": "text/plain",
                "content-range": f"bytes 0-{len(body) - 1}/{len(body) + 20}",
            },
            body,
            url,
        )

    items, counters = crawl(truncated_robots)
    assert items == []
    assert requested == ["https://example.com/robots.txt"]
    assert counters.robots_denied == 1


def test_403_and_429_remain_safe_failures() -> None:
    for status in (403, 429):
        async def rejected(url: str, response_status: int = status) -> Response:
            if url.endswith("robots.txt"):
                return Response(
                    200,
                    {"content-type": "text/plain"},
                    b"User-agent: *\nAllow: /",
                    url,
                )
            return Response(response_status, {"content-type": "text/html"}, b"rejected", url)

        items, counters = crawl(rejected)
        assert items == []
        assert counters.failed == 1
