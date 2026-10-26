"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/lib/auth";
import {
  RECOVERY_EXPIRED_MESSAGE,
  recoveryRedirectUrl,
  safeAuthErrorDetails,
  SiteUrlConfigurationError,
  updateRecoveredPassword,
} from "@/lib/auth-recovery";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8).max(128);

export async function signInAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({ email: emailSchema, password: z.string().min(1).max(128) })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email and password." };
  }

  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] sign-in failed", { code: "missing_supabase_config" });
    return {
      status: "error",
      message: "Client access is not connected yet. Contact Supra Integration.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.warn("[auth] sign-in failed", safeAuthErrorDetails(error));
    return { status: "error", message: "Email or password was not recognized." };
  }

  redirect(await getPostLoginPath());
}

export async function requestPasswordResetAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] recovery request failed", {
      code: "missing_supabase_config",
    });
    return {
      status: "error",
      message: "Password recovery is not connected yet. Contact Supra Integration.",
    };
  }

  let redirectTo: string;
  try {
    redirectTo = recoveryRedirectUrl();
  } catch (error) {
    const code =
      error instanceof SiteUrlConfigurationError
        ? error.diagnosticCode
        : "invalid_site_url";
    console.error("[auth] recovery request failed", { code });
    return {
      status: "error",
      message: "Password recovery is temporarily unavailable. Try again later.",
    };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo,
  });

  if (error) {
    console.error(
      "[auth] recovery request failed",
      safeAuthErrorDetails(error),
    );
    return {
      status: "error",
      message: "Password recovery is temporarily unavailable. Try again later.",
    };
  }

  return {
    status: "success",
    message:
      "If an account exists for that address, a recovery link is on its way.",
  };
}

export async function updatePasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({
      password: passwordSchema,
      confirmation: passwordSchema,
    })
    .refine((value) => value.password === value.confirmation, {
      message: "Passwords do not match.",
    })
    .safeParse({
      password: formData.get("password"),
      confirmation: formData.get("confirmation"),
    });

  if (!parsed.success) {
    return {
      status: "error",
      message:
        parsed.error.issues[0]?.message ?? "Enter a password with at least 8 characters.",
    };
  }

  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] password update failed", {
      code: "missing_supabase_config",
    });
    return { status: "error", message: "Account access is not connected yet." };
  }

  const result = await updateRecoveredPassword(parsed.data.password, {
    getUser: () => supabase.auth.getUser(),
    updateUser: (attributes) => supabase.auth.updateUser(attributes),
  });

  if (!result.ok) {
    console.warn("[auth] password update failed", {
      ...safeAuthErrorDetails(result.error),
      code: result.reason,
    });
    return {
      status: "error",
      message:
        result.reason === "expired_recovery_session"
          ? RECOVERY_EXPIRED_MESSAGE
          : "Password could not be updated. Request a new recovery link.",
    };
  }

  return {
    status: "success",
    message: "Password updated. You can return to your dashboard.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/login");
}
