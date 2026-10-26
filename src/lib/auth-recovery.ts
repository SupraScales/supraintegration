export const RECOVERY_EXPIRED_MESSAGE =
  "Recovery link expired. Request a new one.";
export const PRODUCTION_SITE_URL = "https://www.supraintegration.ai";

type SiteEnvironment = Partial<
  Record<
    | "NODE_ENV"
    | "VERCEL_ENV"
    | "VERCEL_URL"
    | "NEXT_PUBLIC_SITE_URL"
    | "NEXT_PUBLIC_VERCEL_URL",
    string | undefined
  >
>;

export class SiteUrlConfigurationError extends Error {
  readonly diagnosticCode:
    | "missing_production_site_url"
    | "invalid_production_site_url";

  constructor(
    diagnosticCode:
      | "missing_production_site_url"
      | "invalid_production_site_url",
  ) {
    super(diagnosticCode);
    this.name = "SiteUrlConfigurationError";
    this.diagnosticCode = diagnosticCode;
  }
}

function normalizeHttpOrigin(rawValue: string, production: boolean) {
  const candidate = rawValue.includes("://")
    ? rawValue
    : `https://${rawValue}`;

  try {
    const url = new URL(candidate);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const allowedProtocol = url.protocol === "https:" || (!production && url.protocol === "http:");

    if (
      !allowedProtocol ||
      (production && isLocalhost) ||
      url.username ||
      url.password ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      throw new Error("invalid origin");
    }

    return url.origin;
  } catch {
    if (production) {
      throw new SiteUrlConfigurationError("invalid_production_site_url");
    }
    throw new Error("Invalid NEXT_PUBLIC_SITE_URL.");
  }
}

export function resolveSiteUrl(environment: SiteEnvironment = process.env) {
  const vercelEnvironment = environment.VERCEL_ENV;
  const isProductionRuntime = environment.NODE_ENV === "production";
  const isPreview = vercelEnvironment === "preview";
  const vercelPreviewUrl =
    environment.NEXT_PUBLIC_VERCEL_URL ?? environment.VERCEL_URL;

  if (isPreview && vercelPreviewUrl) {
    return normalizeHttpOrigin(vercelPreviewUrl, true);
  }

  if (environment.NEXT_PUBLIC_SITE_URL) {
    const configuredOrigin = normalizeHttpOrigin(
      environment.NEXT_PUBLIC_SITE_URL,
      isProductionRuntime,
    );

    if (
      isProductionRuntime &&
      !isPreview &&
      configuredOrigin !== PRODUCTION_SITE_URL
    ) {
      throw new SiteUrlConfigurationError("invalid_production_site_url");
    }

    return configuredOrigin;
  }

  if (isProductionRuntime) {
    throw new SiteUrlConfigurationError("missing_production_site_url");
  }

  return "http://localhost:3000";
}

export function recoveryRedirectUrl(environment: SiteEnvironment = process.env) {
  return new URL("/auth/callback", resolveSiteUrl(environment)).toString();
}

export function safeRecoveryNextPath(value: string | null) {
  return value === "/auth/update-password"
    ? value
    : "/auth/update-password";
}

export function recoveryFailurePath() {
  return "/forgot-password?error=recovery-link-expired";
}

export function recoveryPageMessage(error: string | undefined) {
  return error === "recovery-link-expired" ? RECOVERY_EXPIRED_MESSAGE : null;
}

export async function exchangeRecoveryCode(
  code: string,
  exchange: (code: string) => Promise<{ error: unknown | null }>,
) {
  const result = await exchange(code);
  return result.error
    ? { ok: false as const, error: result.error }
    : { ok: true as const };
}

type AuthErrorShape = {
  code?: string;
  name?: string;
  status?: number;
};

export function safeAuthErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: "unknown_auth_error" };
  }

  const authError = error as AuthErrorShape;
  return {
    code: authError.code ?? "unknown_auth_error",
    ...(authError.name ? { name: authError.name } : {}),
    ...(typeof authError.status === "number" ? { status: authError.status } : {}),
  };
}

type UserLookupResult = {
  data: { user: unknown | null };
  error: unknown | null;
};

type PasswordUpdateResult = { error: unknown | null };

export async function updateRecoveredPassword(
  password: string,
  dependencies: {
    getUser: () => Promise<UserLookupResult>;
    updateUser: (attributes: { password: string }) => Promise<PasswordUpdateResult>;
  },
) {
  const userResult = await dependencies.getUser();
  if (userResult.error || !userResult.data.user) {
    return {
      ok: false as const,
      reason: "expired_recovery_session" as const,
      error: userResult.error,
    };
  }

  const updateResult = await dependencies.updateUser({ password });
  if (updateResult.error) {
    return {
      ok: false as const,
      reason: "password_update_failed" as const,
      error: updateResult.error,
    };
  }

  return { ok: true as const };
}
