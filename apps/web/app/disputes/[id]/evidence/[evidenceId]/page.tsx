import Link from 'next/link';
import { Navbar } from '../../../../../components/layout/Navbar';
import { Footer } from '../../../../../components/layout/Footer';
import { formatGen } from '../../../../../lib/format-gen';
import { apiFetch } from '../../../../../lib/api-client';
import { MyStakeStatus } from './MyStakeStatus';

export const revalidate = 5;

interface DisputeDetail {
  id: string;
  question: string;
  status: string;
  positions: Array<{ id: string; contractPositionId: string; label: string }>;
  evidence: Array<{
    id: string;
    positionId: string;
    sourceUrl: string;
    sourceTitle: string;
    publisher: string;
    summary: string;
    totalStakeWei: string;
    outcome: string | null;
    submitter: string;
  }>;
}

async function fetchDispute(id: string): Promise<DisputeDetail | null> {
  try {
    return await apiFetch<DisputeDetail>(`/disputes/${id}`);
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

export default async function EvidenceDetailPage({
  params,
}: {
  params: { id: string; evidenceId: string };
}): Promise<React.ReactElement> {
  const dispute = await fetchDispute(params.id);
  const evidence = dispute?.evidence.find((e) => e.id === params.evidenceId) ?? null;

  if (!dispute || !evidence) {
    return (
      <>
        <Navbar />
        <main className="mt-24 max-w-[720px] mx-auto px-gutter-mobile py-stack-lg text-center">
          <p className="text-text-muted">Evidence not found &mdash; it may not have synced yet, or the id is wrong.</p>
          <Link href={`/disputes/${params.id}`} className="text-primary hover:underline text-body-sm mt-stack-sm inline-block">
            Back to dispute
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const position = dispute.positions.find((p) => p.id === evidence.positionId);

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-stack-lg max-w-[900px] mx-auto px-gutter-mobile md:px-margin-desktop">
        <div className="mb-stack-md">
          <Link href={`/disputes/${dispute.id}`} className="text-primary hover:underline text-body-sm">
            &larr; {dispute.question}
          </Link>
        </div>

        <div
          className={`bg-surface ghost-border p-stack-lg rounded-lg ${
            evidence.outcome
              ? OUTCOME_COLOR[evidence.outcome]?.includes('verified')
                ? 'status-strip-verified'
                : OUTCOME_COLOR[evidence.outcome]?.includes('slashed')
                  ? 'status-strip-slashed'
                  : 'status-strip-pending'
              : ''
          }`}
        >
          <div className="flex items-center gap-2 mb-stack-sm">
            <span className="material-symbols-outlined text-primary text-[22px]">description</span>
            <a
              href={evidence.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface hover:text-primary transition-colors"
            >
              {evidence.sourceTitle}
            </a>
          </div>

          <p className="text-body-md text-on-surface-variant mb-stack-md">{evidence.summary}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-md mb-stack-md">
            <div>
              <div className="text-label-caps text-text-muted text-[10px] mb-1">PUBLISHER</div>
              <div className="text-body-sm text-on-surface">{evidence.publisher}</div>
            </div>
            <div>
              <div className="text-label-caps text-text-muted text-[10px] mb-1">SUPPORTS</div>
              <div className="text-body-sm text-on-surface">{position?.label ?? 'Unknown position'}</div>
            </div>
            <div>
              <div className="text-label-caps text-text-muted text-[10px] mb-1">TOTAL STAKE</div>
              <div className="font-code-sm text-primary">{formatGen(evidence.totalStakeWei)} GEN</div>
            </div>
            <div>
              <div className="text-label-caps text-text-muted text-[10px] mb-1">SUBMITTER</div>
              <Link href={`/profile/${evidence.submitter}`} className="font-code-sm text-on-surface hover:text-primary transition-colors">
                {evidence.submitter.slice(0, 6)}...{evidence.submitter.slice(-4)}
              </Link>
            </div>
          </div>

          <div className="p-stack-sm bg-background/50 border border-border-subtle mb-stack-md">
            <div className="text-label-caps text-on-surface-variant text-[10px] mb-1">VERDICT</div>
            <div className={`font-code-sm text-body-md ${evidence.outcome ? OUTCOME_COLOR[evidence.outcome] : 'text-text-muted'}`}>
              {evidence.outcome ? evidence.outcome.replace(/_/g, ' ') : 'Pending adjudication'}
            </div>
          </div>

          <div className="p-stack-sm border-t border-border-subtle">
            <MyStakeStatus evidenceContractId={evidence.id} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
