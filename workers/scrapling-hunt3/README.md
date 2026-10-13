# SkyShare Hunt #3 Scrapling POC

This Python 3.12 worker discovers official public-web evidence for the existing
Western Dealer Group Acquisition & Expansion hunt. It does not qualify, score,
or publish leads. The existing TypeScript Hunt #3 parser and persistence core
remain authoritative.

## Security boundary

- Seven explicit dealer-group domains are configured in `config/dealer-domains.json`.
- Only HTTPS on port 443 is accepted. Credentials in URLs are rejected.
- DNS results are rejected when any address is local, private, link-local,
  reserved, non-global, or a known metadata endpoint.
- Redirects are disabled in Scrapling and followed only after the same domain
  and SSRF checks are repeated.
- Plain `AsyncFetcher` HTTP is used with browser impersonation, stealth headers,
  proxies, CAPTCHA solving, and browser automation disabled.
- Requests use a 15-second timeout, two bounded retries, a one-second per-domain
  delay, a three-domain concurrency limit, and a 2 MiB accepted-body limit.
- `robots.txt` is consulted before a page is fetched.

## Install and verify

Create a Python 3.12 virtual environment and install `requirements.lock`. Do
not run `scrapling install`; this POC does not install or launch browsers.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.lock
PYTHONPATH=src .venv/bin/pytest tests
PYTHONPATH=src .venv/bin/ruff check src tests
PYTHONPATH=src .venv/bin/mypy --config-file pyproject.toml src
```

## Controlled invocation

The default invocation writes normalized JSONL only:

```bash
PYTHONPATH=src .venv/bin/python -m skyshare_scrapling.cli \
  --config config/dealer-domains.json \
  --output /tmp/skyshare-hunt3.jsonl
```

`--write-supabase` additionally writes new URL keys to the existing internal
`lead_discovery_items` inbox. It requires the four variables shown in
`deploy/skyshare-hunt3.env.example`. Secret values must come from the VPS
secret store and must never be placed in the repository or logs.

After ingestion, an authorized operator can POST once to
`/api/internal/skyshare-hunt3-public-web`. The route requires the existing
bearer secret and remains disabled unless
`SKYSHARE_DISCOVERY_HUNT3_PUBLIC_WEB_ENABLED=true`. No timer or recurring
scheduler is included.

The systemd unit is a hardened `Type=oneshot` service for an existing non-root
`skyshare-worker` account. After the bounded worker writes normalized inbox
items, a standard-library helper invokes the existing authorized Hunt #3 route.
The helper reads the bearer secret from the service environment and never puts
it in command arguments or logs.

`skyshare-scrapling-hunt3.timer` runs the same unit every Monday and Thursday at
10:15 UTC with up to 30 minutes of randomized delay. Twice weekly is conservative
for dealership acquisition/news frequency while still keeping the pilot current.
systemd does not start a second instance of an already-active oneshot unit;
`RuntimeMaxSec=20min` supplies the outer runtime bound, and `Persistent=true`
performs one catch-up activation after a reboot instead of replaying every missed
schedule.

Install both unit files under `/etc/systemd/system`, populate the environment
file from the secret store, then run `systemctl daemon-reload` and
`systemctl enable --now skyshare-scrapling-hunt3.timer`. Do not enable the timer
against Production as part of this pilot slice.
