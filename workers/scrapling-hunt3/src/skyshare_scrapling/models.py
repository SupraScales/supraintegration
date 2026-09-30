from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Literal

SourceType = Literal["official_dealer_event", "official_dealer_ownership"]


@dataclass(frozen=True)
class DomainConfig:
    name: str
    domain: str
    seeds: tuple[str, ...]


@dataclass(frozen=True)
class DiscoveryItem:
    source_domain: str
    canonical_url: str
    source_type: SourceType
    page_title: str
    event_date: str | None
    content_hash: str
    relevant_text: str
    relationship_links: tuple[str, ...]
    fetch_method: Literal["scrapling_http"]
    http_status: int
    fetched_at: str

    def as_dict(self) -> dict[str, object]:
        value = asdict(self)
        value["relationship_links"] = list(self.relationship_links)
        return value


@dataclass
class RunCounters:
    domains_configured: int = 0
    pages_fetched: int = 0
    pages_discovered: int = 0
    event_pages: int = 0
    ownership_pages: int = 0
    duplicates_skipped: int = 0
    robots_denied: int = 0
    failed: int = 0

    def as_dict(self) -> dict[str, int]:
        return asdict(self)
