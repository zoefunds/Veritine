import Link from 'next/link';
import { formatGen } from '../../lib/format-gen';
import { apiFetch } from '../../lib/api-client';

export const dynamic = 'force-dynamic';

interface DisputeSummary {
  id: string;
  question: string;
  category: string;
  status: string;
  totalStakeWei: string;
  positions: Array<{ label: string; totalStakeWei: string }>;
}

async function fetchDisputes(): Promise<DisputeSummary[]> {
  try {
    const body = await apiFetch<{ items: DisputeSummary[] }>('/disputes?limit=20');
    return body.items ?? [];
  } catch {
    return [];
  }
}

export default async function DisputesPage(): Promise<React.ReactElement> {
  const disputes = await fetchDisputes();

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem' }}>Disputes</h1>
        <Link
          href="/disputes/create"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
            textDecoration: 'none',
          }}
        >
          Create Dispute
        </Link>
      </div>

      {disputes.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>
          No disputes yet, or the indexer hasn&apos;t synced from the contract yet.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {disputes.map((dispute) => (
          <Link
            key={dispute.id}
            href={`/disputes/${dispute.id}`}
            style={{
              display: 'block',
              padding: '1rem',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-container-low)',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {dispute.category}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--pending)', textTransform: 'uppercase' }}>
                {dispute.status}
              </span>
            </div>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>{dispute.question}</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Total stake: {formatGen(dispute.totalStakeWei)} GEN across {dispute.positions.length} positions
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
