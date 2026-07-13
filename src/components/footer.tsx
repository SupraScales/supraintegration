export function Footer() {
  return (
    <footer className="bg-ink px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-paper/[0.78]">
        <div className="font-light">
          &copy; {new Date().getFullYear()} Supra Integration &mdash; a
          SupraScales company.
        </div>
        <div className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-paper/60">
          supraintegration.ai
        </div>
      </div>
    </footer>
  );
}
