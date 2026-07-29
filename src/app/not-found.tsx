import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-grid" aria-hidden />
      <section className="auth-panel">
        <p className="product-kicker"><span aria-hidden />Route unavailable</p>
        <h1>Nothing is enabled <span>here.</span></h1>
        <p className="auth-intro">
          This page does not exist or is not enabled for the current workspace.
        </p>
        <Link className="product-button product-button-primary" href="/">
          Return to Supra Integration
        </Link>
      </section>
    </main>
  );
}
