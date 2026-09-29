from __future__ import annotations

import hashlib
import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

from scrapling.parser import Selector

from .models import DiscoveryItem, SourceType
from .policy import UrlPolicyError, host_allowed, normalize_url

EVENT_TOKENS = ("acqui", "expansion", "opening", "opened", "news", "press", "transaction")
OWNERSHIP_TOKENS = ("about", "leadership", "team", "owner", "management", "principal", "founder")
RELEVANT_LINK_TOKENS = EVENT_TOKENS + OWNERSHIP_TOKENS + ("location", "sitemap", "rss")
DATE_PATTERN = re.compile(r"\b(20\d{2})[-/]([01]\d)[-/]([0-3]\d)(?!\d)")


def classify_page(url: str, title: str, text: str) -> SourceType | None:
    if urlsplit(url).path in ("", "/"):
        return None
    haystack = f"{urlsplit(url).path} {title} {text[:2500]}".lower()
    event_score = sum(token in haystack for token in EVENT_TOKENS)
    ownership_score = sum(token in haystack for token in OWNERSHIP_TOKENS)
    if event_score == ownership_score == 0:
        return None
    return (
        "official_dealer_event"
        if event_score >= ownership_score
        else "official_dealer_ownership"
    )


def _clean_text(page: Selector, max_chars: int = 60_000) -> str:
    parts = page.xpath(
        "//body//text()[not(ancestor::script) and not(ancestor::style) "
        "and not(ancestor::noscript) and not(ancestor::svg)]"
    ).getall()
    return re.sub(r"\s+", " ", " ".join(parts)).strip()[:max_chars]


def _event_date(page: Selector, text: str) -> str | None:
    candidates: list[str] = []
    for selector in (
        '//meta[@property="article:published_time"]/@content',
        '//meta[@name="date"]/@content',
        "//time/@datetime",
    ):
        candidates.extend(str(value) for value in page.xpath(selector).getall())
    candidates.append(text[:3000])
    for candidate in candidates:
        match = DATE_PATTERN.search(candidate)
        if match:
            try:
                parsed = datetime(int(match[1]), int(match[2]), int(match[3]), tzinfo=UTC)
                return parsed.date().isoformat()
            except ValueError:
                continue
    return None


def extract_links(page: Selector, page_url: str, allowlisted_domain: str) -> tuple[str, ...]:
    links: set[str] = set()
    for href in page.css("a::attr(href)").getall():
        if not href or not any(token in href.lower() for token in RELEVANT_LINK_TOKENS):
            continue
        try:
            canonical = normalize_url(href, page_url)
        except (UrlPolicyError, ValueError):
            continue
        host = urlsplit(canonical).hostname
        if host and host_allowed(host, allowlisted_domain):
            links.add(canonical)
    return tuple(sorted(links))


def normalize_page(
    *,
    page: Selector,
    url: str,
    allowlisted_domain: str,
    status: int,
    fetched_at: datetime,
) -> DiscoveryItem | None:
    canonical_url = normalize_url(url)
    title = re.sub(r"\s+", " ", page.css("title::text").get(default="")).strip()[:500]
    text = _clean_text(page)
    source_type = classify_page(canonical_url, title, text)
    if not source_type or not text:
        return None
    return DiscoveryItem(
        source_domain=allowlisted_domain,
        canonical_url=canonical_url,
        source_type=source_type,
        page_title=title,
        event_date=_event_date(page, text),
        content_hash=hashlib.sha256(text.encode()).hexdigest(),
        relevant_text=text,
        relationship_links=extract_links(page, canonical_url, allowlisted_domain),
        fetch_method="scrapling_http",
        http_status=status,
        fetched_at=fetched_at.astimezone(UTC).isoformat(),
    )
