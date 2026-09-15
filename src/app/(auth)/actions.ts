"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/lib/auth";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message: string;
};

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8).max(128);

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

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
    return {
      status: "error",
      message: "Client access is not connected yet. Contact Supra Integration.",
    };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
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
    return {
      status: "error",
      message: "Password recovery is not connected yet. Contact Supra Integration.",
    };
  }

  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
  });

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
    return { status: "error", message: "Account access is not connected yet." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message: "The recovery link is invalid or expired. Request a new one.",
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
