import { ForgotPasswordForm } from "@/components/auth-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="product-kicker"><span aria-hidden />Account recovery</p>
      <h1>Reset your <span>access.</span></h1>
      <p className="auth-intro">
        Enter your account email. If it is active, we will send a secure
        recovery link.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
