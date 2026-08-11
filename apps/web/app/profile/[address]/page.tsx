import Link from 'next/link';
import { VeritineReadClient } from '@veritine/contract-client';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { formatGen } from '../../../lib/format-gen';
import { apiFetch } from '../../../lib/api-client';

export const revalidate = 5;

interface ActivityPosition {
  id: string;
  disputeId: string | null;
  disputeQuestion: string;
  disputeStatus: string;
  positionLabel: string;
  amountWei: string;
  status: string;
  createdAt: string;
}

interface ActivityEvidence {
  id: string;
  disputeId: string | null;
  disputeQuestion: string;
  disputeStatus: string;
  positionLabel: string;
  sourceUrl: string;
  sourceTitle: string;
  submitterStakeWei: string;
  outcome: string | null;
  verificationStatus: string;
  submittedAt: string;
}

async function fetchActivity(address: string): Promise<{ positions: ActivityPosition[]; evidence: ActivityEvidence[] }> {
  try {
    return await apiFetch<{ positions: ActivityPosition[]; evidence: ActivityEvidence[] }>(
      `/users/by-wallet/${address}/activity`,
    );
  } catch {
    return { positions: [], evidence: [] };
  }
}

async function fetchOnChain(address: string): Promise<{ balanceWei: string | null; flagCount: number | null }> {
  try {
    const client = new VeritineReadClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    });
    const [balance, flagCount] = await Promise.all([client.getBalanceOf(address), client.getFlagCount(address)]);
    return { balanceWei: String(balance), flagCount };
  } catch {
    return { balanceWei: null, flagCount: null };
  }
}

export default async function ProfilePage({ params }: { params: { address: string } }): Promise<React.ReactElement> {
  const address = params.address;
  const [{ positions, evidence }, { balanceWei, flagCount }] = await Promise.all([
    fetchActivity(address),
    fetchOnChain(address),
  ]);

  const totalStaked = positions.reduce((sum, p) => sum + BigInt(p.amountWei), BigInt(0));
  const totalEvidenceStaked = evidence.reduce((sum, e) => sum + BigInt(e.submitterStakeWei), BigInt(0));

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-stack-lg max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop">
        <section className="mb-stack-lg">
          <div className="flex items-center gap-stack-sm mb-base">
            <span className="material-symbols-outlined text-primary text-[28px]">account_circle</span>
            <div>
              <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight break-all">
                {address}
              </h1>
              <p className="text-text-muted text-body-sm">Public activity &amp; reputation on Veritine</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-md mb-stack-lg">
          <div className="bg-surface ghost-border p-stack-md rounded-lg">
            <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">CLAIMABLE BALANCE</div>
            <div className="font-headline-lg-mobile text-headline-lg-mobile text-verified">
              {balanceWei !== null ? `${formatGen(balanceWei)} GEN` : 'Unavailable'}
            </div>
          </div>
          <div className="bg-surface ghost-border p-stack-md rounded-lg">
            <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">FLAG COUNT</div>
            <div className={`font-headline-lg-mobile text-headline-lg-mobile ${flagCount ? 'text-slashed' : 'text-on-surface'}`}>
              {flagCount ?? 'Unavailable'}
            </div>
          </div>
          <div className="bg-surface ghost-border p-stack-md rounded-lg">
            <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">POSITION STAKE</div>
            <div className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              {formatGen(totalStaked.toString())} GEN
            </div>
          </div>
          <div className="bg-surface ghost-border p-stack-md rounded-lg">
            <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">EVIDENCE STAKE</div>
            <div className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
              {formatGen(totalEvidenceStaked.toString())} GEN
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-stack-lg">
          <section className="bg-surface p-stack-md ghost-border rounded-lg">
            <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
              POSITIONS ({positions.length})
            </h2>
            {positions.length === 0 && <p className="text-text-muted text-body-sm">No position stakes yet.</p>}
            <div className="space-y-stack-sm">
              {positions.map((p) => (
                <Link
                  key={p.id}
                  href={p.disputeId ? `/disputes/${p.disputeId}` : '/disputes'}
                  className="block p-stack-sm bg-surface-container-low ghost-border rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  <div className="flex justify-between items-start gap-stack-sm">
                    <div className="min-w-0">
                      <p className="font-body-md text-text-primary font-bold truncate">{p.disputeQuestion}</p>
                      <p className="text-text-muted text-body-sm">
                        Backed &ldquo;{p.positionLabel}&rdquo; &middot; {formatGen(p.amountWei)} GEN
                      </p>
                    </div>
                    <span className="shrink-0 bg-pending/10 text-pending font-label-caps text-[10px] px-2 py-0.5 rounded border border-pending/20">
                      {p.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="bg-surface p-stack-md ghost-border rounded-lg">
            <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
              EVIDENCE ({evidence.length})
            </h2>
            {evidence.length === 0 && <p className="text-text-muted text-body-sm">No evidence submitted yet.</p>}
            <div className="space-y-stack-sm">
              {evidence.map((e) => (
                <Link
                  key={e.id}
                  href={e.disputeId ? `/disputes/${e.disputeId}` : '/disputes'}
                  className="block p-stack-sm bg-surface-container-low ghost-border rounded-lg hover:bg-surface-container-high transition-colors"
                >
                  <div className="flex justify-between items-start gap-stack-sm">
                    <div className="min-w-0">
                      <p className="font-body-md text-text-primary font-bold truncate">{e.sourceTitle}</p>
                      <p className="text-text-muted text-body-sm truncate">
                        On &ldquo;{e.disputeQuestion}&rdquo; &middot; supports &ldquo;{e.positionLabel}&rdquo; &middot;{' '}
                        {formatGen(e.submitterStakeWei)} GEN
                      </p>
                    </div>
                    <span className="shrink-0 font-label-caps text-[10px] px-2 py-0.5 rounded border border-border-subtle text-text-muted">
                      {e.outcome ? e.outcome.replace(/_/g, ' ') : e.verificationStatus}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
