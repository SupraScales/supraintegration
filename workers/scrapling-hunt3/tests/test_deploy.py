from __future__ import annotations

import importlib.util
import io
from pathlib import Path
from types import ModuleType

import pytest

WORKER_ROOT = Path(__file__).resolve().parents[1]
DEPLOY_ROOT = WORKER_ROOT / "deploy"


def load_invoker() -> ModuleType:
    path = DEPLOY_ROOT / "invoke_hunt3_processor.py"
    spec = importlib.util.spec_from_file_location("invoke_hunt3_processor", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "url",
    [
        "http://demo.example/api/internal/skyshare-hunt3-public-web",
        "https://demo.example:8443/api/internal/skyshare-hunt3-public-web",
        "https://user:secret@demo.example/api/internal/skyshare-hunt3-public-web",
        "https://demo.example/api/internal/skyshare-hunt3-public-web?debug=1",
        "https://demo.example/api/internal/other",
    ],
)
def test_processor_url_fails_closed_for_unsafe_targets(url: str) -> None:
    invoker = load_invoker()
    with pytest.raises(ValueError, match="exact HTTPS internal route"):
        invoker.processor_url(url)


def test_processor_url_accepts_only_the_exact_https_route() -> None:
    invoker = load_invoker()
    url = "https://demo.example/api/internal/skyshare-hunt3-public-web"
    assert invoker.processor_url(url) == url


def test_processor_posts_once_without_redirects_or_secret_logging(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    invoker = load_invoker()
    requests: list[object] = []

    class Response(io.BytesIO):
        def __enter__(self) -> Response:
            return self

        def __exit__(self, *_args: object) -> None:
            self.close()

    class Opener:
        def open(self, request: object, timeout: int) -> Response:
            requests.append(request)
            assert timeout == 300
            return Response(b'{"status":"completed"}')

    monkeypatch.setenv(
        "SKYSHARE_HUNT3_PROCESS_URL",
        "https://demo.example/api/internal/skyshare-hunt3-public-web",
    )
    monkeypatch.setenv("SKYSHARE_HUNT3_PROCESS_SECRET", "do-not-log-this-secret")
    monkeypatch.setattr(invoker.urllib.request, "build_opener", lambda *_args: Opener())

    assert invoker.main() == 0
    assert len(requests) == 1
    output = capsys.readouterr()
    assert "hunt3_processing_completed" in output.out
    assert "do-not-log-this-secret" not in output.out + output.err
    assert invoker.NoRedirectHandler().redirect_request(None, None, 302, "", {}, "") is None


def test_systemd_units_are_bounded_non_overlapping_and_reboot_safe() -> None:
    service = (DEPLOY_ROOT / "skyshare-scrapling-hunt3.service").read_text()
    timer = (DEPLOY_ROOT / "skyshare-scrapling-hunt3.timer").read_text()

    assert "Type=oneshot" in service
    assert "User=skyshare-worker" in service
    assert "--write-supabase" in service
    assert "ExecStartPost=/usr/bin/python3 " in service
    assert "invoke_hunt3_processor.py" in service
    assert "TimeoutStartSec=20min" in service
    assert "RuntimeMaxSec=20min" in service
    assert "EnvironmentFile=/etc/skyshare/scrapling-hunt3.env" in service
    assert "OnCalendar=Mon,Thu " in timer
    assert "Persistent=true" in timer
    assert "Unit=skyshare-scrapling-hunt3.service" in timer
    assert "Production" not in service + timer
    assert "SKYSHARE_HUNT3_PROCESS_SECRET=" not in service + timer
