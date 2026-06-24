export function CTA() {
  return (
    <section id="contact" className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-[1080px] text-center">
        <h2 className="text-[clamp(1.9rem,4vw,2.8rem)] font-bold tracking-tight">
          Let&apos;s put AI to work in your business
        </h2>
        <p className="mt-5 text-lg text-muted">
          Tell us what&apos;s slowing your team down. We&apos;ll show you
          what&apos;s possible.
        </p>
        <a
          href="mailto:hello@supraintegration.ai"
          className="mt-9 inline-block rounded-[10px] bg-gradient-to-br from-accent to-accent-2 px-7 py-3.5 text-lg font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-90"
        >
          hello@supraintegration.ai
        </a>
      </div>
    </section>
  );
}
