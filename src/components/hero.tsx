export function Hero() {
  return (
    <section className="px-6 pb-28 pt-32 text-center md:pb-28 md:pt-36">
      <div className="mx-auto max-w-[1080px]">
        <span className="mb-7 inline-block rounded-full border border-border px-4 py-1.5 text-xs uppercase tracking-[0.12em] text-accent-2">
          A SupraScales Company
        </span>
        <h1 className="mx-auto max-w-4xl text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-[1.05] tracking-tight">
          AI systems that{" "}
          <span className="bg-gradient-to-br from-accent to-accent-2 bg-clip-text text-transparent">
            work where you work
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl">
          We design, build, and deploy AI automation and agent workflows that
          plug directly into the tools your business already runs on — no
          rip-and-replace, no guesswork.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3.5">
          <a
            href="#contact"
            className="rounded-[10px] bg-gradient-to-br from-accent to-accent-2 px-6 py-3 font-semibold text-white transition-all hover:-translate-y-0.5 hover:opacity-90"
          >
            Book a consultation
          </a>
          <a
            href="#services"
            className="rounded-[10px] border border-border bg-bg-soft px-6 py-3 font-semibold text-fg transition-all hover:-translate-y-0.5 hover:border-accent"
          >
            Explore services
          </a>
        </div>
      </div>
    </section>
  );
}
