import { getVeritineReadClient } from '../lib/veritine-read-client';
import { formatGen } from '../lib/format-gen';

/**
 * Server component - reads live data directly from the deployed Veritine
 * contract on every request. No mocking, no client-side fetch needed for
 * this read since it doesn't depend on wallet state.
 */
export async function LivePlatformStats(): Promise<React.ReactElement> {
  const client = getVeritineReadClient();

  let stats: Record<string, unknown> | null = null;
  let error: string | null = null;
  try {
    stats = await client.getPlatformStats();
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to read from the deployed contract';
  }

  if (error) {
    return (
      <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>
        Could not reach the deployed contract: {error}
      </p>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '1rem',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-container-low)',
      }}
    >
      <Stat label="Disputes" value={String(stats?.dispute_count ?? 0)} />
      <Stat label="Evidence Submitted" value={String(stats?.evidence_count ?? 0)} />
      <Stat label="Adjudicated" value={String(stats?.total_disputes_adjudicated ?? 0)} />
      <Stat label="Total Volume (GEN)" value={formatGen((stats?.total_volume_wei as string | number) ?? 0)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}

export function LivePlatformStatsSkeleton(): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        gap: '2rem',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: '1rem',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-container-low)',
      }}
    >
      {['Disputes', 'Evidence Submitted', 'Adjudicated', 'Total Volume (GEN)'].map((label) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '1.5rem',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-muted)',
            }}
          >
            &hellip;
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
