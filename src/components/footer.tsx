export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-muted">
        <div>
          &copy; {new Date().getFullYear()} Supra Integration &mdash; a
          SupraScales company.
        </div>
        <div className="font-display tracking-tight text-gold/40">
          supraintegration.ai
        </div>
      </div>
    </footer>
  );
}
