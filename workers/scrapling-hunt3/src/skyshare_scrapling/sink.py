from __future__ import annotations

import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from .models import DiscoveryItem


class SinkError(RuntimeError):
    pass


@dataclass
class JsonlSink:
    path: Path

    def write(self, items: Iterable[DiscoveryItem]) -> int:
        materialized = list(items)
        with self.path.open("w", encoding="utf-8") as handle:
            for item in materialized:
                handle.write(json.dumps(item.as_dict(), sort_keys=True) + "\n")
        return len(materialized)


@dataclass
class SupabaseInboxSink:
    supabase_url: str
    secret_key: str
    organization_id: str
    hunt_id: str
    timeout_seconds: int = 20

    def __post_init__(self) -> None:
        parsed = urlsplit(self.supabase_url)
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.port not in (None, 443)
        ):
            raise SinkError("Supabase inbox origin must be a direct HTTPS URL.")

    def _row(self, item: DiscoveryItem) -> dict[str, object]:
        source_key_hash = hashlib.sha256(item.canonical_url.encode()).hexdigest()
        return {
            "organization_id": self.organization_id,
            "hunt_id": self.hunt_id,
            "source_key": f"public-web:{source_key_hash}",
            "source_type": item.source_type,
            "source_url": item.canonical_url,
            "form_type": "PUBLIC_WEB",
            "accession_number": None,
            "issuer_cik": None,
            "filing_date": None,
            "metadata": item.as_dict(),
        }

    def write(self, items: Iterable[DiscoveryItem]) -> int:
        rows = [self._row(item) for item in items]
        if not rows:
            return 0
        query = urllib.parse.urlencode(
            {"on_conflict": "organization_id,hunt_id,source_key", "select": "id"}
        )
        request = urllib.request.Request(  # noqa: S310 -- fixed Supabase origin, not user input
            f"{self.supabase_url.rstrip('/')}/rest/v1/lead_discovery_items?{query}",
            data=json.dumps(rows).encode(),
            method="POST",
            headers={
                "apikey": self.secret_key,
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json",
                "Prefer": "resolution=ignore-duplicates,return=representation",
            },
        )
        try:
            # The request origin is validated as direct HTTPS in __post_init__.
            with urllib.request.urlopen(  # noqa: S310  # nosec B310
                request,
                timeout=self.timeout_seconds,
            ) as response:
                stored = json.loads(response.read())
        except (urllib.error.URLError, json.JSONDecodeError) as error:
            raise SinkError("Public-web discovery inbox write failed.") from error
        return len(stored)
