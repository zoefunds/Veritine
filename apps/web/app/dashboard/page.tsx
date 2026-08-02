import Link from 'next/link';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { formatGen } from '../../lib/format-gen';
import { apiFetch } from '../../lib/api-client';
import { WalletCard } from './DashboardClient';

// See apps/web/app/disputes/page.tsx for why this uses a short revalidate
// window instead of force-dynamic.
export const revalidate = 5;

interface DisputeSummary {
  id: string;
  question: string;
  category: string;
  status: string;
  totalStakeWei: string;
}

async function fetchRecentDisputes(): Promise<DisputeSummary[]> {
  try {
    const body = await apiFetch<{ items: DisputeSummary[] }>('/disputes?limit=5');
    return body.items ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage(): Promise<React.ReactElement> {
  const disputes = await fetchRecentDisputes();

  return (
    <>
      <Navbar />
      <main className="max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop pt-24 pb-stack-lg">
        <header className="mb-stack-lg flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-text-primary mb-base">Command Center</h1>
            <p className="text-text-muted font-body-sm text-body-sm">Your Veritine dashboard</p>
          </div>
          <div className="flex items-center gap-base px-stack-sm py-base bg-surface-container rounded-lg border border-border-subtle">
            <span className="w-2 h-2 rounded-full bg-verified" />
            <span className="font-label-caps text-label-caps text-on-surface">Network: GenLayer StudioNet</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-md">
          <div className="lg:col-span-8 flex flex-col gap-stack-md">
            <section className="bg-surface p-stack-md ghost-border rounded-lg">
              <div className="flex justify-between items-center mb-stack-md">
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile flex items-center gap-base">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Recent Disputes
                </h2>
                <Link href="/disputes" className="text-primary font-label-caps text-label-caps hover:underline">
                  View All
                </Link>
              </div>

              {disputes.length === 0 && <p className="text-text-muted text-body-sm">No disputes yet.</p>}

              <div className="space-y-stack-md">
                {disputes.map((dispute) => (
                  <Link
                    key={dispute.id}
                    href={`/disputes/${dispute.id}`}
                    className="block p-stack-md bg-surface-container-low ghost-border rounded-lg group hover:bg-surface-container-high transition-colors"
                  >
                    <div className="flex justify-between items-start mb-stack-sm">
                      <div>
                        <h3 className="font-body-md text-text-primary font-bold">{dispute.question}</h3>
                        <p className="text-text-muted text-body-sm font-body-sm">
                          Stake: {formatGen(dispute.totalStakeWei)} GEN &middot; {dispute.category}
                        </p>
                      </div>
                      <span className="bg-pending/10 text-pending font-label-caps text-[10px] px-2 py-0.5 rounded border border-pending/20">
                        {dispute.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-stack-md">
            <WalletCard />

            <div className="grid grid-cols-2 gap-stack-sm">
              <Link
                href="/disputes/create"
                className="p-stack-md bg-surface border border-border-subtle rounded-lg flex flex-col items-center gap-base hover:border-primary transition-all group"
              >
                <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">
                  add_moderator
                </span>
                <span className="font-label-caps text-[10px]">New Dispute</span>
              </Link>
              <Link
                href="/disputes"
                className="p-stack-md bg-surface border border-border-subtle rounded-lg flex flex-col items-center gap-base hover:border-secondary transition-all group"
              >
                <span className="material-symbols-outlined text-secondary group-hover:scale-110 transition-transform">
                  travel_explore
                </span>
                <span className="font-label-caps text-[10px]">Explore</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
