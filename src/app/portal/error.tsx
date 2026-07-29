"use client";

export default function PortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="product-empty">
      <span aria-hidden />
      <h2>Portal data is temporarily unavailable</h2>
      <p>
        No account data was changed. Try the request again or contact Supra
        Integration if the problem continues.
      </p>
      <button className="product-button product-button-secondary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
