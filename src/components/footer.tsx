export function Footer() {
  return (
    <footer className="border-t border-border px-6 py-10">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <div>&copy; {new Date().getFullYear()} Supra Integration &mdash; a SupraScales company.</div>
        <div>supraintegration.ai</div>
      </div>
    </footer>
  );
}
