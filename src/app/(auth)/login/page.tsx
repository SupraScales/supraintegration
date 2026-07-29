import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-form";
import { getPostLoginPath, getCurrentAccess } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage() {
  if (await getCurrentAccess()) {
    redirect(await getPostLoginPath());
  }

  const configured = isSupabaseConfigured();

  return (
    <>
      <p className="product-kicker"><span aria-hidden />Secure client access</p>
      <h1>Enter the <span>system.</span></h1>
      <p className="auth-intro">
        View the signals, priorities, and connected systems enabled for your
        organization.
      </p>
      {!configured ? (
        <div className="system-notice">
          <b>Access provisioning in progress</b>
          <p>
            The portal interface is ready, but authentication has not been
            connected to the production data project.
          </p>
        </div>
      ) : null}
      <LoginForm />
      <p className="auth-support">
        Need access? <a href="mailto:hello@supraintegration.ai">Contact Supra Integration</a>
      </p>
    </>
  );
}
