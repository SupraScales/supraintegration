import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <>
      <p className="product-kicker"><span aria-hidden />Access unavailable</p>
      <h1>No active <span>workspace.</span></h1>
      <p className="auth-intro">
        Your login is valid, but it is not assigned to an active organization.
        Supra Integration can correct the account assignment.
      </p>
      <a className="product-button product-button-primary" href="mailto:hello@supraintegration.ai">
        Contact support
      </a>
      <Link href="/" className="auth-text-link">Return to the public site</Link>
    </>
  );
}
