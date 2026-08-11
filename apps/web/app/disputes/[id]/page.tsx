import Link from 'next/link';
import { Navbar } from '../../../components/layout/Navbar';
import { Footer } from '../../../components/layout/Footer';
import { formatGen } from '../../../lib/format-gen';
import { apiFetch } from '../../../lib/api-client';
import { StakePositionForm, SubmitEvidenceForm, RequestAdjudicationButton } from './DisputeDetailClient';

// See apps/web/app/disputes/page.tsx for why this uses a short revalidate
// window instead of force-dynamic.
export const revalidate = 5;

interface DisputeDetail {
  id: string;
  question: string;
  description: string;
  category: string;
  status: string;
  totalStakeWei: string;
  minPositionStakeWei: string;
  minEvidenceStakeWei: string;
  participationDeadline: string;
  evidenceDeadline: string;
  creator: string;
  positions: Array<{ contractPositionId: string; label: string; totalStakeWei: string }>;
  evidence: Array<{
    id: string;
    sourceUrl: string;
    sourceTitle: string;
    publisher: string;
    summary: string;
    totalStakeWei: string;
    outcome: string | null;
    submitter: string;
  }>;
  adjudication: { conclusion: string; reasoningSummary: string; adjudicatedAt: string } | null;
}

async function fetchDispute(id: string): Promise<DisputeDetail | null> {
  try {
    // cache: 'no-store', not the usual 5s revalidate window - this route
    // was observed serving a stale cached 200 (a dispute that existed on
    // a previous contract deployment) indefinitely after the backing DB
    // row was gone, well past several multiples of the revalidate window.
    // Whether that's Vercel's fetch Data Cache surviving a deploy or a
    // stale-while-revalidate edge case, a wrong dispute ID silently
    // resolving to a DIFFERENT dispute's data - worst of all across a
    // contract migration - is a correctness bug, not a minor staleness
    // one. This route needs a guaranteed-fresh read every time.
    const dispute = await apiFetch<DisputeDetail>(`/disputes/${id}`, { cache: 'no-store' });
    // Defensive fallback: these two fields were briefly missing from the
    // API response (see disputes.controller.ts) after being added to this
    // interface, which crashed the whole page via formatGen(undefined).
    // Coerce to "0" rather than trust the response shape unconditionally.
    return {
      ...dispute,
      minPositionStakeWei: dispute.minPositionStakeWei ?? '0',
      minEvidenceStakeWei: dispute.minEvidenceStakeWei ?? '0',
    };
  } catch {
    return null;
  }
}

const OUTCOME_COLOR: Record<string, string> = {
  STRONGLY_SUPPORTED: 'text-verified',
  CREDIBLE_AND_RELEVANT: 'text-verified',
  CREDIBLE_BUT_LIMITED: 'text-pending',
  INCONCLUSIVE: 'text-pending',
  OUTDATED_NOT_DECEPTIVE: 'text-pending',
  WEAK_OR_INCOMPLETE: 'text-slashed',
  MATERIALLY_IRRELEVANT: 'text-slashed',
  MISLEADING: 'text-slashed',
  FABRICATED_OR_UNVERIFIABLE: 'text-slashed',
  MALICIOUSLY_MANIPULATED: 'text-slashed',
};

export default async function DisputeDetailPage({ params }: { params: { id: string } }): Promise<React.ReactElement> {
  const dispute = await fetchDispute(params.id);

  if (!dispute) {
    return (
      <>
        <Navbar />
        <main className="mt-24 max-w-[720px] mx-auto px-gutter-mobile py-stack-lg text-center">
          <p className="text-text-muted">
            Dispute not found &mdash; it may not have synced from the contract yet, or the id is wrong.
          </p>
        </main>
        <Footer />
      </>
    );
  }

  const totalPositionStake = dispute.positions.reduce((sum, p) => sum + Number(p.totalStakeWei), 0);

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-stack-lg max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop">
        <section className="mb-stack-lg">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
            <div className="max-w-2xl">
              <div className="flex items-center gap-stack-sm mb-base">
                <span className="flex items-center gap-1 font-label-caps text-label-caps text-primary">
                  <span className="w-2 h-2 rounded-full bg-primary" /> {dispute.status.replace('_', ' ')}
                </span>
                <span className="text-outline-variant text-label-caps">&bull;</span>
                <span className="font-label-caps text-label-caps text-on-surface-variant">
                  Dispute #{dispute.id} &middot; {dispute.category}
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight">
                {dispute.question}
              </h1>
              {dispute.description && <p className="text-text-muted mt-stack-sm">{dispute.description}</p>}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="text-on-surface-variant font-label-caps text-label-caps">TOTAL STAKE</div>
              <div className="font-headline-lg text-headline-lg text-primary">
                {formatGen(dispute.totalStakeWei)} <span className="text-body-sm font-label-caps">GEN</span>
              </div>
              <div className="flex items-center gap-2 text-pending font-label-caps text-label-caps">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                Evidence closes {new Date(dispute.evidenceDeadline).toLocaleDateString()}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-12 gap-gutter-desktop">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-stack-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
              {dispute.positions.map((position, i) => {
                const stake = Number(position.totalStakeWei);
                const pct = totalPositionStake > 0 ? (stake / totalPositionStake) * 100 : 0;
                const isLead = i === 0;
                return (
                  <div
                    key={position.contractPositionId}
                    className="bg-surface ghost-border p-stack-md relative group hover:bg-surface-bright transition-colors overflow-hidden"
                  >
                    <div className={`absolute top-0 left-0 w-1 h-full ${isLead ? 'bg-primary' : 'bg-outline-variant'}`} />
                    <div className="font-label-caps text-label-caps text-primary uppercase mb-stack-sm">
                      Position {i + 1}
                    </div>
                    <div className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-stack-sm">
                      {position.label}
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">STAKED</div>
                        <div className="text-body-md font-bold text-on-surface">{formatGen(position.totalStakeWei)} GEN</div>
                      </div>
                      <div className="text-right">
                        <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">SUPPORT</div>
                        <div className="text-body-md font-bold text-primary">{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="mt-stack-md w-full bg-surface-container h-1.5 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-surface ghost-border p-stack-md rounded">
              <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-md">Stake on a Position</h2>
              {dispute.status === 'ACTIVE' ? (
                <StakePositionForm
                  disputeContractId={dispute.id}
                  positions={dispute.positions}
                  minStakeWei={dispute.minPositionStakeWei}
                />
              ) : (
                <p className="text-text-muted text-body-sm">
                  This dispute is no longer accepting new stakes ({dispute.status.replace(/_/g, ' ').toLowerCase()}).
                </p>
              )}
            </div>

            <div className="flex flex-col gap-stack-md">
              <div className="flex items-center justify-between border-b border-border-subtle pb-base">
                <h2 className="font-label-caps text-label-caps text-on-surface tracking-widest">
                  EVIDENCE REGISTRY ({dispute.evidence.length})
                </h2>
              </div>

              {dispute.evidence.length === 0 && (
                <p className="text-text-muted text-body-sm">No evidence submitted yet.</p>
              )}

              {dispute.evidence.map((item) => (
                <div
                  key={item.id}
                  className={`bg-surface ghost-border p-stack-md flex flex-col md:flex-row md:items-center justify-between gap-stack-md hover:bg-surface-container transition-colors ${
                    item.outcome
                      ? OUTCOME_COLOR[item.outcome]?.includes('verified')
                        ? 'status-strip-verified'
                        : OUTCOME_COLOR[item.outcome]?.includes('slashed')
                          ? 'status-strip-slashed'
                          : 'status-strip-pending'
                      : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-[18px]">description</span>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-body-md font-semibold text-on-surface hover:text-primary">
                        {item.sourceTitle}
                      </a>
                    </div>
                    <p className="text-body-sm text-on-surface-variant mb-1">{item.summary}</p>
                    <div className="flex flex-wrap gap-4 text-body-sm text-on-surface-variant">
                      <span>
                        <span className="font-label-caps">Publisher:</span> {item.publisher}
                      </span>
                      <span>
                        <span className="font-label-caps text-primary">Stake:</span> {formatGen(item.totalStakeWei)} GEN
                      </span>
                      <Link href={`/profile/${item.submitter}`} className="hover:text-primary transition-colors">
                        <span className="font-label-caps">By:</span> {item.submitter.slice(0, 6)}...{item.submitter.slice(-4)}
                      </Link>
                    </div>
                  </div>
                  <div className="text-right min-w-[140px]">
                    <div className="text-label-caps text-on-surface-variant text-[10px] mb-1">OUTCOME</div>
                    <div className={`font-code-sm ${item.outcome ? OUTCOME_COLOR[item.outcome] : 'text-text-muted'}`}>
                      {item.outcome ? item.outcome.replace(/_/g, ' ') : 'Pending adjudication'}
                    </div>
                    <Link
                      href={`/disputes/${dispute.id}/evidence/${item.id}`}
                      className="text-[11px] text-primary hover:underline mt-1 inline-block"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              ))}

              <div className="bg-surface ghost-border p-stack-md rounded">
                <h3 className="font-label-caps text-label-caps text-on-surface mb-stack-md">Submit Evidence</h3>
                {dispute.status === 'ACTIVE' ? (
                  <SubmitEvidenceForm
                    disputeContractId={dispute.id}
                    positions={dispute.positions}
                    minStakeWei={dispute.minEvidenceStakeWei}
                  />
                ) : (
                  <p className="text-text-muted text-body-sm">
                    The evidence registry is closed for this dispute ({dispute.status.replace(/_/g, ' ').toLowerCase()}).
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-stack-lg">
            {!dispute.adjudication && (
              <RequestAdjudicationButton
                disputeContractId={dispute.id}
                evidenceDeadline={dispute.evidenceDeadline}
                status={dispute.status}
              />
            )}

            <div className="bg-surface ghost-border p-stack-md rounded-lg overflow-hidden border-t-4 border-primary">
              <div className="flex items-center gap-stack-sm mb-stack-md">
                <div className="bg-primary/20 p-2 rounded">
                  <span className="material-symbols-outlined text-primary">smart_toy</span>
                </div>
                <div>
                  <h2 className="font-label-caps text-label-caps text-primary">GENLAYER ADJUDICATION</h2>
                  <p className="text-[10px] text-on-surface-variant">Automated Consensus Engine</p>
                </div>
              </div>

              {dispute.adjudication ? (
                <div className="space-y-stack-md">
                  <div className="bg-background/50 p-stack-sm border border-border-subtle">
                    <h3 className="text-label-caps text-on-surface mb-2 border-b border-border-subtle pb-1">
                      CONCLUSION
                    </h3>
                    <p className="text-body-sm text-primary font-bold">{dispute.adjudication.conclusion.replace(/_/g, ' ')}</p>
                  </div>
                  <p className="text-body-sm text-on-surface-variant leading-relaxed">
                    {dispute.adjudication.reasoningSummary}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    Adjudicated {new Date(dispute.adjudication.adjudicatedAt).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="space-y-stack-md">
                  <div className="bg-background/50 p-stack-sm border border-border-subtle">
                    <h3 className="text-label-caps text-on-surface mb-2 border-b border-border-subtle pb-1">
                      PROTOCOL LOGIC
                    </h3>
                    <p className="text-body-sm text-on-surface-variant leading-relaxed">
                      At the evidence deadline, GenLayer validators independently fetch every cited source and
                      run an <span className="text-primary">evidence-verification loop</span> before settlement.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                      <div className="text-body-sm text-on-surface-variant">
                        <span className="text-on-surface font-bold">Web Fetching:</span> validators crawl every
                        cited URL and compare it against the submitter&apos;s claim.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                      <div className="text-body-sm text-on-surface-variant">
                        <span className="text-on-surface font-bold">Independent verification:</span> a custom
                        validator re-derives each verdict rather than trusting the leader&apos;s output.
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-2 h-2 rounded-full bg-primary/40 shrink-0" />
                      <div className="text-body-sm text-on-surface-variant">
                        <span className="text-on-surface font-bold">Settlement:</span> a deterministic result is
                        broadcast to GenLayer to settle the pool.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-surface ghost-border p-stack-md">
              <h3 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
                DISPUTE INFO
              </h3>
              <div className="space-y-stack-sm">
                <div className="flex justify-between items-center text-body-sm">
                  <span className="text-on-surface-variant">Creator</span>
                  <Link href={`/profile/${dispute.creator}`} className="font-code-sm text-on-surface hover:text-primary transition-colors">
                    {dispute.creator.slice(0, 6)}...{dispute.creator.slice(-4)}
                  </Link>
                </div>
                <div className="flex justify-between items-center text-body-sm">
                  <span className="text-on-surface-variant">Evidence Count</span>
                  <span className="font-code-sm text-on-surface">{dispute.evidence.length}</span>
                </div>
                <div className="flex justify-between items-center text-body-sm">
                  <span className="text-on-surface-variant">Positions</span>
                  <span className="font-code-sm text-on-surface">{dispute.positions.length}</span>
                </div>
                <div className="flex justify-between items-center text-body-sm">
                  <span className="text-on-surface-variant">Min Position Stake</span>
                  <span className="font-code-sm text-on-surface">{formatGen(dispute.minPositionStakeWei)} GEN</span>
                </div>
                <div className="flex justify-between items-center text-body-sm">
                  <span className="text-on-surface-variant">Min Evidence Stake</span>
                  <span className="font-code-sm text-on-surface">{formatGen(dispute.minEvidenceStakeWei)} GEN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
