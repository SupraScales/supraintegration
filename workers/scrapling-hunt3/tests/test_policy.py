from __future__ import annotations

import socket

import pytest

from skyshare_scrapling.policy import (
    UrlPolicyError,
    normalize_url,
    validate_public_url,
    validate_redirect,
)


def resolver_for(address: str):
    def resolve(*_args: object, **_kwargs: object):
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]

    return resolve


def test_url_normalization_removes_fragments_tracking_and_default_port() -> None:
    assert normalize_url("https://WWW.Example.com:443/news/../news/item/?utm_source=x&b=2#a") == (
        "https://www.example.com/news/item/?b=2"
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com/news",
        "file:///etc/passwd",
        "https://user:password@example.com/news",
        "https://example.com:8443/news",
    ],
)
def test_non_https_or_credentialed_sources_are_rejected(url: str) -> None:
    with pytest.raises(UrlPolicyError):
        validate_public_url(url, "example.com", resolver=resolver_for("93.184.216.34"))


@pytest.mark.parametrize("address", ["127.0.0.1", "10.0.0.4", "169.254.169.254", "::1"])
def test_ssrf_addresses_are_rejected(address: str) -> None:
    with pytest.raises(UrlPolicyError):
        validate_public_url(
            "https://example.com/news",
            "example.com",
            resolver=resolver_for(address),
        )

def test_official_domain_is_exact_and_redirect_escape_is_rejected() -> None:
    resolver = resolver_for("93.184.216.34")
    assert validate_public_url(
        "https://www.example.com/news",
        "example.com",
        resolver=resolver,
    ) == "https://www.example.com/news"
    with pytest.raises(UrlPolicyError):
        validate_public_url(
            "https://example.com.attacker.test/news",
            "example.com",
            resolver=resolver,
        )
    with pytest.raises(UrlPolicyError):
        validate_redirect(
            "https://attacker.test/internal",
            "https://example.com/news",
            "example.com",
            resolver=resolver,
        )
