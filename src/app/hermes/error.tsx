"use client";

export default function HermesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="product-empty">
      <span aria-hidden />
      <h2>Hermes could not complete the request</h2>
      <p>
        No configuration change has been confirmed. Retry or inspect the server
        logs before repeating an administrative write.
      </p>
      <button className="product-button product-button-secondary" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
