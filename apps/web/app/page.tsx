import { Suspense } from 'react';
import Link from 'next/link';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import { LivePlatformStats, LivePlatformStatsSkeleton } from '../components/LivePlatformStats';

export const dynamic = 'force-dynamic';

export default function HomePage(): React.ReactElement {
  return (
    <>
      <Navbar />
      <main className="mt-16">
        {/* Hero */}
        <section className="relative min-h-[720px] flex flex-col items-center justify-center text-center px-gutter-mobile md:px-margin-desktop py-stack-lg overflow-hidden">
          <div className="relative z-10 max-w-4xl">
            <span className="inline-block px-3 py-1 mb-6 rounded-full border border-primary/30 bg-primary/5 text-primary font-label-caps text-label-caps">
              LIVE ON GENLAYER STUDIONET
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[72px] md:leading-[80px] text-text-primary mb-stack-md">
              The Staked <br />
              <span className="text-primary">Knowledge War</span>
            </h1>
            <p className="font-body-md text-body-md text-text-muted max-w-2xl mx-auto mb-stack-lg leading-relaxed">
              Veritine turns controversial factual questions into structured, evidence-backed,
              economically accountable disputes. Stake behind a position, or behind a specific piece
              of evidence &mdash; a GenLayer Intelligent Contract independently fetches and verifies
              every cited source before anyone gets paid.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
              <Link
                href="/disputes"
                className="w-full md:w-auto bg-primary-container text-on-primary-container px-10 py-4 rounded font-bold text-body-md hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                Launch Explorer
                <span className="material-symbols-outlined">rocket_launch</span>
              </Link>
              <Link
                href="/docs"
                className="w-full md:w-auto bg-surface border border-border-subtle text-on-surface px-10 py-4 rounded font-bold text-body-md hover:bg-surface-container-high transition-all"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </section>

        {/* Live stats */}
        <section className="max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop pb-stack-lg">
          <Suspense fallback={<LivePlatformStatsSkeleton />}>
            <LivePlatformStats />
          </Suspense>
        </section>

        {/* Trust problem */}
        <section className="max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop py-24">
          <div className="mb-stack-lg text-center md:text-left">
            <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4">
              Attention is the enemy of truth
            </h2>
            <p className="text-text-muted max-w-xl">
              In an era of deepfakes and mass misinformation, words are cheap. Veritine makes them
              expensive again.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter-desktop">
            <div className="md:col-span-8 bg-surface p-stack-lg ghost-border rounded-xl">
              <span className="font-label-caps text-label-caps text-primary mb-2 block">THE FLAW</span>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mb-4">
                Attention-based media fails
              </h3>
              <p className="text-text-muted font-body-md leading-relaxed">
                Modern information networks reward outrage, not accuracy. Algorithms amplify
                engagement, creating a landscape where sensational claims outpace verified facts.
                There is zero economic consequence for being wrong.
              </p>
              <div className="mt-8 pt-8 border-t border-border-subtle flex gap-8">
                <div>
                  <div className="font-headline-lg text-headline-lg text-slashed">0</div>
                  <div className="font-label-caps text-label-caps text-text-muted">Economic Accountability</div>
                </div>
                <div>
                  <div className="font-headline-lg text-headline-lg text-slashed">High</div>
                  <div className="font-label-caps text-label-caps text-text-muted">Misinformation ROI</div>
                </div>
              </div>
            </div>
            <div className="md:col-span-4 bg-surface-container p-stack-lg ghost-border rounded-xl flex flex-col items-center text-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary text-3xl">security</span>
              </div>
              <h3 className="font-headline-lg text-headline-lg text-on-surface mb-2">Skin in the Game</h3>
              <p className="text-text-muted font-body-sm">
                Evidence-staking creates a real financial barrier to entry for claims, ensuring only
                high-confidence evidence enters the registry.
              </p>
            </div>
            <div className="md:col-span-4 bg-surface-container-low p-stack-md ghost-border rounded-xl">
              <span className="material-symbols-outlined text-verified mb-4 block">verified</span>
              <h4 className="font-bold text-on-surface mb-2">Objective Verification</h4>
              <p className="text-text-muted text-body-sm">
                Adjudication via GenLayer validator consensus, not a single trusted party.
              </p>
            </div>
            <div className="md:col-span-4 bg-surface-container-low p-stack-md ghost-border rounded-xl">
              <span className="material-symbols-outlined text-tertiary mb-4 block">account_balance_wallet</span>
              <h4 className="font-bold text-on-surface mb-2">Proportional Consequences</h4>
              <p className="text-text-muted text-body-sm">
                Honest, well-evidenced participants earn from the stakes of those who submit weak or
                fabricated evidence &mdash; never simply for backing the losing side.
              </p>
            </div>
            <div className="md:col-span-4 bg-surface-container-low p-stack-md ghost-border rounded-xl">
              <span className="material-symbols-outlined text-secondary mb-4 block">history_edu</span>
              <h4 className="font-bold text-on-surface mb-2">Immutable Registry</h4>
              <p className="text-text-muted text-body-sm">
                Every dispute, stake, and verdict is recorded on-chain, permanently and transparently.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-surface-container-lowest py-24 border-y border-border-subtle">
          <div className="max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop">
            <h2 className="font-headline-lg text-headline-lg text-center text-on-surface mb-16">
              The Evidence Lifecycle
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <div className="hidden md:block absolute top-1/4 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-outline-variant to-transparent -z-10" />
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded bg-surface ghost-border flex items-center justify-center font-code-sm text-primary mb-6 ring-4 ring-background">
                  01
                </div>
                <h3 className="text-on-surface font-bold mb-4">Propose a Question</h3>
                <p className="text-text-muted text-body-sm">
                  Submit a factually adjudicable claim. Define competing positions, a participation
                  window, and an evidence window.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded bg-surface ghost-border flex items-center justify-center font-code-sm text-primary mb-6 ring-4 ring-background">
                  02
                </div>
                <h3 className="text-on-surface font-bold mb-4">Stake Evidence</h3>
                <p className="text-text-muted text-body-sm">
                  Participants deposit GEN alongside source URLs, publisher metadata, and a summary of
                  how the evidence supports a position.
                </p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded bg-surface ghost-border flex items-center justify-center font-code-sm text-primary mb-6 ring-4 ring-background">
                  03
                </div>
                <h3 className="text-on-surface font-bold mb-4">Trustless Adjudication</h3>
                <p className="text-text-muted text-body-sm">
                  GenLayer validators independently fetch every cited source and evaluate its
                  authenticity, authority, relevance, and support &mdash; then settle the dispute.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Evidence quality categories */}
        <section className="max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop py-24">
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-4 text-center">
            Evidence Is Judged on Quality, Not Popularity
          </h2>
          <p className="text-text-muted text-center max-w-2xl mx-auto mb-stack-lg">
            A larger stake never implies stronger evidence. Every submission is independently
            classified into one of ten outcome tiers, each with a proportional, documented economic
            consequence.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter-desktop">
            <div className="bg-surface-container-low p-stack-md ghost-border rounded-xl status-strip-verified">
              <span className="material-symbols-outlined text-verified mb-2 block">check_circle</span>
              <h4 className="font-bold text-on-surface mb-1">Strongly Supported / Credible</h4>
              <p className="text-text-muted text-body-sm">
                Full stake returned, plus a proportional share of the reward pool.
              </p>
            </div>
            <div className="bg-surface-container-low p-stack-md ghost-border rounded-xl status-strip-pending">
              <span className="material-symbols-outlined text-pending mb-2 block">help</span>
              <h4 className="font-bold text-on-surface mb-1">Limited / Inconclusive / Outdated</h4>
              <p className="text-text-muted text-body-sm">
                Full refund, no reward and no slash &mdash; good-faith evidence that just wasn&apos;t decisive.
              </p>
            </div>
            <div className="bg-surface-container-low p-stack-md ghost-border rounded-xl status-strip-slashed">
              <span className="material-symbols-outlined text-slashed mb-2 block">gavel</span>
              <h4 className="font-bold text-on-surface mb-1">Weak, Misleading, or Fabricated</h4>
              <p className="text-text-muted text-body-sm">
                Slashed 25&ndash;100% depending on severity &mdash; never for merely backing the losing side.
              </p>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop py-stack-lg">
          <div className="relative bg-gradient-to-br from-surface to-surface-container rounded-2xl p-margin-desktop text-center overflow-hidden ghost-border">
            <h2 className="font-headline-lg text-[36px] leading-tight text-on-surface mb-6">
              Ready to stake your expertise?
            </h2>
            <p className="text-text-muted max-w-xl mx-auto mb-10">
              Join researchers, journalists, and public-interest investigators maintaining the
              integrity of the global knowledge pool.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/disputes/create"
                className="bg-primary-container text-on-primary-container px-12 py-4 rounded font-bold text-body-md hover:scale-105 transition-transform"
              >
                Create a Dispute
              </Link>
              <Link
                href="/disputes"
                className="bg-transparent border border-border-subtle text-on-surface px-12 py-4 rounded font-bold text-body-md hover:bg-surface-container-high transition-all"
              >
                Browse Disputes
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
