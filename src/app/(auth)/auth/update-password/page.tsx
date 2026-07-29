import { UpdatePasswordForm } from "@/components/auth-form";

export default function UpdatePasswordPage() {
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
