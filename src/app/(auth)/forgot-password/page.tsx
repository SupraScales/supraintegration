import { ForgotPasswordForm } from "@/components/auth-form";
import { recoveryPageMessage } from "@/lib/auth-recovery";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const message = recoveryPageMessage((await searchParams).error);

  return (
    <>
      <p className="product-kicker"><span aria-hidden />Account recovery</p>
      <h1>Reset your <span>access.</span></h1>
      <p className="auth-intro">
        Enter your account email. If it is active, we will send a secure
        recovery link.
      </p>
      {message ? (
        <p className="form-message form-message-error" role="alert">
          {message}
        </p>
      ) : null}
      <ForgotPasswordForm />
    </>
  );
}
