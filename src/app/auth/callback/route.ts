import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeRecoveryCode,
  recoveryFailurePath,
  safeAuthErrorDetails,
  safeRecoveryNextPath,
} from "@/lib/auth-recovery";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRecoveryNextPath(requestUrl.searchParams.get("next"));
  const providerErrorCode = requestUrl.searchParams.get("error_code");
  const supabase = await createClient();

  if (code && supabase) {
    const result = await exchangeRecoveryCode(code, (recoveryCode) =>
      supabase.auth.exchangeCodeForSession(recoveryCode),
    );
    if (result.ok) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    console.warn(
      "[auth] recovery code exchange failed",
      safeAuthErrorDetails(result.error),
    );
  } else if (!supabase) {
    console.error("[auth] recovery callback failed", {
      code: "missing_supabase_config",
    });
  } else {
    console.warn("[auth] recovery callback failed", {
      code:
        providerErrorCode === "otp_expired"
          ? "expired_recovery_token"
          : "missing_recovery_code",
    });
  }

  return NextResponse.redirect(
    new URL(recoveryFailurePath(), requestUrl.origin),
  );
}
