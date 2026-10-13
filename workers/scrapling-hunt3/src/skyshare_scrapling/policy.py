from __future__ import annotations

import ipaddress
import posixpath
import socket
from collections.abc import Callable, Iterable
from typing import Any
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

TRACKING_QUERY_KEYS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term",
}
METADATA_IPS = {ipaddress.ip_address("169.254.169.254"), ipaddress.ip_address("100.100.100.200")}
Resolver = Callable[..., Iterable[tuple[Any, ...]]]


class UrlPolicyError(ValueError):
    pass


def normalized_host(value: str) -> str:
    host = value.rstrip(".").lower().encode("idna").decode("ascii")
    return host.removeprefix("www.")


def host_allowed(host: str, allowlisted_domain: str) -> bool:
    return normalized_host(host) == normalized_host(allowlisted_domain)


def normalize_url(value: str, base_url: str | None = None) -> str:
    absolute = urljoin(base_url, value) if base_url else value
    parsed = urlsplit(absolute)
    if parsed.scheme.lower() != "https":
        raise UrlPolicyError("Only HTTPS public sources are allowed.")
    if parsed.username or parsed.password or not parsed.hostname:
        raise UrlPolicyError("Credentialed or hostless URLs are not allowed.")
    host = parsed.hostname.rstrip(".").lower().encode("idna").decode("ascii")
    port = parsed.port
    if port not in (None, 443):
        raise UrlPolicyError("Only the standard HTTPS port is allowed.")
    path = posixpath.normpath(parsed.path or "/")
    if not path.startswith("/"):
        path = f"/{path}"
    if parsed.path.endswith("/") and path != "/":
        path = f"{path}/"
    query = urlencode(
        sorted((key, value) for key, value in parse_qsl(parsed.query, keep_blank_values=True)
               if key.lower() not in TRACKING_QUERY_KEYS),
        doseq=True,
    )
    return urlunsplit(("https", host, path, query, ""))


def _is_public_address(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return ip not in METADATA_IPS and ip.is_global


def validate_public_url(
    value: str,
    allowlisted_domain: str,
    resolver: Resolver = socket.getaddrinfo,
) -> str:
    canonical = normalize_url(value)
    host = urlsplit(canonical).hostname
    if not host or not host_allowed(host, allowlisted_domain):
        raise UrlPolicyError("URL escaped the configured official domain.")
    try:
        addresses = {result[4][0] for result in resolver(host, 443, type=socket.SOCK_STREAM)}
    except OSError as error:
        raise UrlPolicyError("Official source DNS resolution failed.") from error
    if not addresses or any(not _is_public_address(address) for address in addresses):
        raise UrlPolicyError("URL resolved to a private, local, reserved, or metadata address.")
    return canonical


def validate_redirect(
    location: str,
    current_url: str,
    allowlisted_domain: str,
    resolver: Resolver = socket.getaddrinfo,
) -> str:
    return validate_public_url(
        normalize_url(location, current_url),
        allowlisted_domain,
        resolver=resolver,
    )
