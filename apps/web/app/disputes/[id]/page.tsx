import { formatGen } from '../../../lib/format-gen';
import { apiFetch } from '../../../lib/api-client';
import { StakePositionForm, SubmitEvidenceForm } from './DisputeDetailClient';

export const dynamic = 'force-dynamic';

interface DisputeDetail {
  id: string;
  question: string;
  description: string;
  category: string;
  status: string;
  totalStakeWei: string;
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
  adjudication: { conclusion: string; reasoningSummary: string } | null;
}

async function fetchDispute(id: string): Promise<DisputeDetail | null> {
  try {
    return await apiFetch<DisputeDetail>(`/disputes/${id}`);
  } catch {
    return null;
  }
}

export default async function DisputeDetailPage({ params }: { params: { id: string } }): Promise<React.ReactElement> {
  const dispute = await fetchDispute(params.id);

  if (!dispute) {
    return (
      <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem' }}>
        <p>Dispute not found (it may not have synced from the contract yet).</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <span style={{ fontSize: '0.75rem', color: 'var(--pending)', textTransform: 'uppercase' }}>{dispute.status}</span>
        <h1 style={{ fontSize: '1.75rem', margin: '0.5rem 0' }}>{dispute.question}</h1>
        <p style={{ color: 'var(--text-muted)' }}>{dispute.description}</p>
      </div>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Positions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {dispute.positions.map((p) => (
            <div key={p.contractPositionId} style={{ padding: '0.75rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              {p.label} — {formatGen(p.totalStakeWei)} GEN
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Stake on a Position</h2>
        <StakePositionForm disputeContractId={dispute.id} positions={dispute.positions} />
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Evidence ({dispute.evidence.length})</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {dispute.evidence.map((e) => (
            <div key={e.id} style={{ padding: '0.75rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>
                {e.sourceTitle}
              </a>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{e.summary}</p>
              <p style={{ fontSize: '0.75rem' }}>
                {formatGen(e.totalStakeWei)} GEN staked {e.outcome ? `— ${e.outcome}` : '— not yet adjudicated'}
              </p>
            </div>
          ))}
        </div>
        <SubmitEvidenceForm disputeContractId={dispute.id} positions={dispute.positions} />
      </section>

      {dispute.adjudication && (
        <section>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Adjudication Result</h2>
          <p><strong>{dispute.adjudication.conclusion}</strong></p>
          <p style={{ color: 'var(--text-muted)' }}>{dispute.adjudication.reasoningSummary}</p>
        </section>
      )}
    </main>
  );
}
