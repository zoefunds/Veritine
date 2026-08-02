export function Footer(): React.ReactElement {
  return (
    <footer className="w-full py-stack-lg px-gutter-mobile md:px-margin-desktop border-t border-border-subtle bg-surface-container-lowest mt-stack-lg">
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-stack-md">
        <div className="flex flex-col items-center md:items-start gap-base">
          <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold tracking-tight">
            Veritine
          </span>
          <p className="font-label-caps text-label-caps text-text-muted">
            &copy; 2026 Veritine. Powered by GenLayer.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-stack-md">
          <a className="font-label-caps text-label-caps text-text-muted hover:text-on-surface transition-colors" href="/docs">
            Documentation
          </a>
          <a className="font-label-caps text-label-caps text-text-muted hover:text-on-surface transition-colors" href="https://github.com/zoefunds/Veritine" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="font-label-caps text-label-caps text-text-muted hover:text-on-surface transition-colors" href="/docs#security">
            Security
          </a>
          <a className="font-label-caps text-label-caps text-text-muted hover:text-on-surface transition-colors" href="/docs#transparency">
            Transparency Report
          </a>
        </div>
      </div>
    </footer>
  );
}
