from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

PROCESSOR_PATH = "/api/internal/skyshare-hunt3-public-web"
MAX_RESPONSE_BYTES = 64 * 1024


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


def processor_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value.strip())
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.port not in (None, 443)
        or parsed.path != PROCESSOR_PATH
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Hunt 3 processor URL must be the exact HTTPS internal route.")
    return urllib.parse.urlunsplit(("https", parsed.hostname, PROCESSOR_PATH, "", ""))


def main() -> int:
    raw_url = os.environ.get("SKYSHARE_HUNT3_PROCESS_URL", "")
    secret = os.environ.get("SKYSHARE_HUNT3_PROCESS_SECRET", "").strip()
    if not raw_url or not secret:
        print("Hunt 3 processor configuration is incomplete.", file=sys.stderr)
        return 2
    try:
        url = processor_url(raw_url)
        request = urllib.request.Request(  # noqa: S310
            url,
            method="POST",
            headers={"Authorization": f"Bearer {secret}", "Accept": "application/json"},
        )
        opener = urllib.request.build_opener(NoRedirectHandler)
        with opener.open(request, timeout=300) as response:  # noqa: S310  # nosec B310
            body = response.read(MAX_RESPONSE_BYTES + 1)
        if len(body) > MAX_RESPONSE_BYTES:
            raise RuntimeError("Hunt 3 processor response exceeded the configured limit.")
        payload = json.loads(body)
        if payload.get("status") not in {"completed", "hunt_paused", "already_running"}:
            raise RuntimeError("Hunt 3 processor returned a non-success status.")
        print(json.dumps({"event": "hunt3_processing_completed", "status": payload["status"]}))
        return 0
    except (ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
    except urllib.error.HTTPError as error:
        print(f"Hunt 3 processor returned HTTP {error.code}.", file=sys.stderr)
    except urllib.error.URLError:
        print("Hunt 3 processor request failed.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
