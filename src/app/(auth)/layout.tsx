import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="auth-page">
      <div className="auth-grid" aria-hidden />
      <Link href="/" className="auth-brand">
        <span aria-hidden />
        <b>SUPRA</b>INTEGRATION
      </Link>
      <section className="auth-panel">{children}</section>
      <p className="auth-security-note">
        Private system access · Sessions are protected and organization-scoped
      </p>
    </main>
  );
}
