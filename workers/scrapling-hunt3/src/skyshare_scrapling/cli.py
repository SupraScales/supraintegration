from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
from pathlib import Path

from .models import DomainConfig
from .sink import JsonlSink, SupabaseInboxSink
from .worker import crawl_domains, log_event


def load_config(path: Path) -> list[DomainConfig]:
    data = json.loads(path.read_text(encoding="utf-8"))
    domains = data.get("domains")
    if not isinstance(domains, list) or not 5 <= len(domains) <= 10:
        raise ValueError("Configure between five and ten official dealer domains.")
    return [
        DomainConfig(
            name=str(item["name"]),
            domain=str(item["domain"]),
            seeds=tuple(str(seed) for seed in item["seeds"]),
        )
        for item in domains
    ]


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Bounded SkyShare Hunt #3 public-web discovery")
    value.add_argument("--config", type=Path, required=True)
    value.add_argument("--output", type=Path, required=True)
    value.add_argument("--write-supabase", action="store_true")
    return value


async def run(args: argparse.Namespace) -> int:
    configs = load_config(args.config)
    items, counters = await crawl_domains(configs)
    JsonlSink(args.output).write(items)
    inserted = 0
    if args.write_supabase:
        required = {
            name: os.environ.get(name, "").strip()
            for name in (
                "SUPABASE_URL",
                "SUPABASE_SECRET_KEY",
                "SKYSHARE_ORGANIZATION_ID",
                "SKYSHARE_HUNT3_ID",
            )
        }
        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")
        inserted = SupabaseInboxSink(
            supabase_url=required["SUPABASE_URL"],
            secret_key=required["SUPABASE_SECRET_KEY"],
            organization_id=required["SKYSHARE_ORGANIZATION_ID"],
            hunt_id=required["SKYSHARE_HUNT3_ID"],
        ).write(items)
    log_event("run_completed", **counters.as_dict(), inbox_inserted=inserted)
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    return asyncio.run(run(parser().parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
