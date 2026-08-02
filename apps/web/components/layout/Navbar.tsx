import Link from 'next/link';
import { ConnectWalletButton } from '../ConnectWalletButton';

export function Navbar(): React.ReactElement {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-center border-b border-border-subtle glass-nav">
      <nav className="w-full max-w-[1280px] h-16 flex justify-between items-center px-gutter-mobile md:px-margin-desktop">
        <div className="flex items-center gap-gutter-desktop">
          <Link href="/" className="font-headline-lg text-headline-lg-mobile md:text-headline-lg font-bold text-on-surface tracking-tight">
            Veritine
          </Link>
          <div className="hidden md:flex gap-stack-lg items-center">
            <Link href="/disputes" className="text-on-surface-variant font-body-md text-body-sm hover:text-primary transition-colors">
              Explorer
            </Link>
            <Link href="/dashboard" className="text-on-surface-variant font-body-md text-body-sm hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link href="/docs" className="text-on-surface-variant font-body-md text-body-sm hover:text-primary transition-colors">
              Docs
            </Link>
          </div>
        </div>
        <ConnectWalletButton compact />
      </nav>
    </header>
  );
}
