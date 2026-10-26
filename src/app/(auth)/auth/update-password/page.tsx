import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth-form";
import { recoveryFailurePath, safeAuthErrorDetails } from "@/lib/auth-recovery";
import { createClient } from "@/lib/supabase/server";

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  if (!supabase) {
    console.error("[auth] recovery page failed", {
      code: "missing_supabase_config",
    });
    redirect(recoveryFailurePath());
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.warn("[auth] recovery page failed", {
      ...safeAuthErrorDetails(error),
      code: "expired_recovery_session",
    });
    redirect(recoveryFailurePath());
  }

  return (
    <>
      <p className="product-kicker"><span aria-hidden />Account recovery</p>
      <h1>Set a new <span>password.</span></h1>
      <p className="auth-intro">
        Use at least eight characters and do not reuse a password from another
        account.
      </p>
      <UpdatePasswordForm />
    </>
  );
}
