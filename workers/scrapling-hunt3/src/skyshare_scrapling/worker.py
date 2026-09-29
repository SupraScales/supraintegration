from __future__ import annotations

import asyncio
import json
import logging
import time
import urllib.robotparser
from collections import deque
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Protocol

from scrapling.fetchers import AsyncFetcher
from scrapling.parser import Selector

from .extractor import extract_links, normalize_page
from .models import DiscoveryItem, DomainConfig, RunCounters
from .policy import Resolver, UrlPolicyError, validate_public_url, validate_redirect

LOGGER = logging.getLogger("skyshare_scrapling")
USER_AGENT = "SupraIntegration-PublicWebDiscovery/0.1 (+mailto:SupraScales@suprascales.com)"
REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class FetchResponse(Protocol):
    @property
    def status(self) -> int: ...

    @property
    def headers(self) -> dict[str, str]: ...

    @property
    def body(self) -> bytes: ...

    @property
    def url(self) -> str: ...


Fetcher = Callable[[str], Awaitable[FetchResponse]]


def log_event(event: str, **values: object) -> None:
    LOGGER.info(json.dumps({"event": event, **values}, sort_keys=True))


async def scrapling_fetch(url: str, *, timeout_seconds: int = 15) -> FetchResponse:
    return await AsyncFetcher.get(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5",
            "Range": "bytes=0-2097151",
            "User-Agent": USER_AGENT,
        },
        timeout=timeout_seconds,
        retries=0,
        follow_redirects=False,
        impersonate=None,
        stealthy_headers=False,
        verify=True,
    )


class DomainCrawler:
    def __init__(
        self,
        config: DomainConfig,
        *,
        fetcher: Fetcher = scrapling_fetch,
        max_pages: int = 12,
        max_response_bytes: int = 2 * 1024 * 1024,
        max_redirects: int = 5,
        retries: int = 2,
        request_delay_seconds: float = 1.0,
        resolver: Resolver | None = None,
    ) -> None:
        self.config = config
        self.fetcher = fetcher
        self.max_pages = max_pages
        self.max_response_bytes = max_response_bytes
        self.max_redirects = max_redirects
        self.retries = retries
        self.request_delay_seconds = request_delay_seconds
        self.resolver = resolver
        self._last_request_at = 0.0
        self._robots: urllib.robotparser.RobotFileParser | None = None

    async def _throttle(self) -> None:
        wait = self.request_delay_seconds - (time.monotonic() - self._last_request_at)
        if wait > 0:
            await asyncio.sleep(wait)

    async def _request(self, url: str) -> FetchResponse:
        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            await self._throttle()
            try:
                response = await self.fetcher(url)
                self._last_request_at = time.monotonic()
                return response
            except Exception as error:  # bounded retry boundary around transport only
                last_error = error
                if attempt < self.retries:
                    await asyncio.sleep(2**attempt)
        raise RuntimeError("Official source fetch failed after bounded retries.") from last_error

    async def _fetch_with_redirects(self, value: str) -> FetchResponse:
        resolver = self.resolver
        current = (
            validate_public_url(value, self.config.domain, resolver=resolver)
            if resolver
            else validate_public_url(value, self.config.domain)
        )
        for _ in range(self.max_redirects + 1):
            response = await self._request(current)
            if response.status not in REDIRECT_STATUSES:
                if len(response.body) > self.max_response_bytes:
                    raise RuntimeError(
                        "Official source response exceeded the configured size limit."
                    )
                return response
            location = response.headers.get("location") or response.headers.get("Location")
            if not location:
                raise RuntimeError("Official source redirect omitted a Location header.")
            current = (
                validate_redirect(location, current, self.config.domain, resolver=resolver)
                if resolver
                else validate_redirect(location, current, self.config.domain)
            )
        raise RuntimeError("Official source exceeded the redirect limit.")

    async def _load_robots(self) -> urllib.robotparser.RobotFileParser:
        if self._robots:
            return self._robots
        robots_url = f"https://{self.config.domain}/robots.txt"
        parser = urllib.robotparser.RobotFileParser(robots_url)
        try:
            response = await self._fetch_with_redirects(robots_url)
            if response.status == 200:
                parser.parse(response.body.decode("utf-8", "replace").splitlines())
            else:
                parser.parse([])
        except (RuntimeError, UrlPolicyError):
            parser.parse([])
        self._robots = parser
        return parser

    async def crawl(self, counters: RunCounters) -> list[DiscoveryItem]:
        robots = await self._load_robots()
        queue = deque(self.config.seeds)
        seen: set[str] = set()
        items: dict[str, DiscoveryItem] = {}
        while queue and len(seen) < self.max_pages:
            raw_url = queue.popleft()
            try:
                url = (
                    validate_public_url(raw_url, self.config.domain, resolver=self.resolver)
                    if self.resolver
                    else validate_public_url(raw_url, self.config.domain)
                )
            except UrlPolicyError:
                counters.failed += 1
                continue
            if url in seen:
                counters.duplicates_skipped += 1
                continue
            seen.add(url)
            if not robots.can_fetch(USER_AGENT, url):
                counters.robots_denied += 1
                continue
            try:
                response = await self._fetch_with_redirects(url)
                counters.pages_fetched += 1
                if response.status != 200:
                    counters.failed += 1
                    continue
                content_type = response.headers.get("content-type", "").lower()
                if "html" not in content_type and "xhtml" not in content_type:
                    continue
                page = Selector(response.body, url=response.url)
                item = normalize_page(
                    page=page,
                    url=response.url,
                    allowlisted_domain=self.config.domain,
                    status=response.status,
                    fetched_at=datetime.now(UTC),
                )
                for link in extract_links(page, response.url, self.config.domain):
                    if link not in seen:
                        queue.append(link)
                if item:
                    if item.canonical_url in items:
                        counters.duplicates_skipped += 1
                    else:
                        items[item.canonical_url] = item
                        counters.pages_discovered += 1
                        if item.source_type == "official_dealer_event":
                            counters.event_pages += 1
                        else:
                            counters.ownership_pages += 1
            except (RuntimeError, UrlPolicyError):
                counters.failed += 1
                log_event("fetch_failed", domain=self.config.domain, url=url)
        return list(items.values())


async def crawl_domains(
    configs: list[DomainConfig],
    *,
    fetcher_factory: Callable[[DomainConfig], Fetcher] | None = None,
    concurrency: int = 3,
) -> tuple[list[DiscoveryItem], RunCounters]:
    counters = RunCounters(domains_configured=len(configs))
    semaphore = asyncio.Semaphore(concurrency)

    async def crawl_one(config: DomainConfig) -> list[DiscoveryItem]:
        async with semaphore:
            fetcher = fetcher_factory(config) if fetcher_factory else scrapling_fetch
            return await DomainCrawler(config, fetcher=fetcher).crawl(counters)

    results = await asyncio.gather(*(crawl_one(config) for config in configs))
    unique: dict[str, DiscoveryItem] = {}
    for item in (item for result in results for item in result):
        unique.setdefault(item.canonical_url, item)
    return list(unique.values()), counters
