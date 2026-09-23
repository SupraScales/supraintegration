const SEC_HOSTS = new Set(["www.sec.gov", "data.sec.gov"]);
const DEFAULT_USER_AGENT = "Supra Integration Lead Intelligence SupraScales@suprascales.com";

export class SecTransportError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, input: { code: string; retryable: boolean; status?: number | null }) {
    super(message);
    this.name = "SecTransportError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.status = input.status ?? null;
  }
}

export function isSecTransportError(error: unknown): error is SecTransportError {
  return error instanceof SecTransportError;
}

type SecFetcherDependencies = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  onAttempt?: () => void;
  onRetry?: (input: { status: number | null; waitMilliseconds: number }) => void;
};

type SecTextRequest = {
  accept: string;
  maxBytes: number;
  timeoutMs?: number;
  maxAttempts?: number;
};

function retryAfterMilliseconds(value: string | null, now: number) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

async function readBoundedText(response: Response, maxBytes: number) {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new SecTransportError("SEC response exceeded the configured size limit.", {
      code: "response_too_large", retryable: false, status: response.status,
    });
  }
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new SecTransportError("SEC response exceeded the configured size limit.", {
        code: "response_too_large", retryable: false, status: response.status,
      });
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

export function createSecFetcher(dependencies: SecFetcherDependencies = {}) {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const now = dependencies.now ?? Date.now;
  let nextRequestAt = 0;

  return async function fetchSecText(urlValue: string, request: SecTextRequest) {
    const url = new URL(urlValue);
    if (url.protocol !== "https:" || !SEC_HOSTS.has(url.hostname)) {
      throw new SecTransportError("Only official SEC HTTPS hosts are accepted.", { code: "invalid_sec_url", retryable: false });
    }

    const timeoutMs = request.timeoutMs ?? 15_000;
    const maxAttempts = request.maxAttempts ?? 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const waitForRateLimit = Math.max(0, nextRequestAt - now());
      if (waitForRateLimit) await sleep(waitForRateLimit);
      nextRequestAt = now() + 200;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        dependencies.onAttempt?.();
        const response = await fetchImpl(url, {
          headers: {
            "User-Agent": process.env.SEC_USER_AGENT?.trim() || DEFAULT_USER_AGENT,
            "Accept-Encoding": "gzip, deflate",
            Accept: request.accept,
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) return await readBoundedText(response, request.maxBytes);
        if (response.status === 404) {
          throw new SecTransportError("SEC resource was not found.", { code: "not_found", retryable: false, status: response.status });
        }
        const retryable = response.status === 403 || response.status === 429 || response.status >= 500;
        if (!retryable || attempt === maxAttempts) {
          throw new SecTransportError(`SEC returned ${response.status}.`, {
            code: `http_${response.status}`, retryable, status: response.status,
          });
        }
        const retryAfter = retryAfterMilliseconds(response.headers.get("retry-after"), now());
        const retryWait = retryAfter ?? Math.min(8_000, 500 * (2 ** (attempt - 1)));
        dependencies.onRetry?.({ status: response.status, waitMilliseconds: retryWait });
        await sleep(retryWait);
      } catch (error) {
        if (isSecTransportError(error)) throw error;
        const timedOut = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
        if (attempt === maxAttempts) {
          throw new SecTransportError(timedOut ? "SEC request timed out." : "SEC request failed.", {
            code: timedOut ? "timeout" : "network_error", retryable: true,
          });
        }
        const retryWait = Math.min(8_000, 500 * (2 ** (attempt - 1)));
        dependencies.onRetry?.({ status: null, waitMilliseconds: retryWait });
        await sleep(retryWait);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new SecTransportError("SEC request failed after bounded retries.", { code: "retry_exhausted", retryable: true });
  };
}
