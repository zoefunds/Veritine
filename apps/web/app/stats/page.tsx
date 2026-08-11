import { VeritineReadClient } from '@veritine/contract-client';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { formatGen } from '../../lib/format-gen';

export const revalidate = 30;

interface PlatformStats {
  dispute_count: number;
  evidence_count: number;
  total_volume_wei: number;
  total_disputes_adjudicated: number;
  total_payouts_wei: number;
  accrued_treasury_wei: number;
  paused: boolean;
}

interface PlatformConfig {
  protocol_fee_bps: number;
  slash_winner_share_bps: number;
  slash_treasury_share_bps: number;
  min_position_stake_wei: number;
  min_evidence_stake_wei: number;
  max_positions_per_dispute: number;
  min_positions_per_dispute: number;
  max_evidence_per_dispute: number;
  adjudication_timeout_seconds: number;
}

interface EvidenceEconomics {
  slash_bps_by_outcome: Record<string, number>;
  reward_eligible_outcomes: string[];
  flagging_outcomes: string[];
  bps_denominator: number;
}

async function fetchOnChain(): Promise<{
  stats: PlatformStats | null;
  config: PlatformConfig | null;
  economics: EvidenceEconomics | null;
}> {
  try {
    const client = new VeritineReadClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
    });
    const [stats, config, economics] = await Promise.all([
      client.getPlatformStats(),
      client.getConfig(),
      client.getEvidenceOutcomeEconomics(),
    ]);
    return {
      stats: stats as unknown as PlatformStats,
      config: config as unknown as PlatformConfig,
      economics: economics as unknown as EvidenceEconomics,
    };
  } catch {
    return { stats: null, config: null, economics: null };
  }
}

function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export default async function StatsPage(): Promise<React.ReactElement> {
  const { stats, config, economics } = await fetchOnChain();

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-stack-lg max-w-[1280px] mx-auto px-gutter-mobile md:px-margin-desktop">
        <section className="mb-stack-lg">
          <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight mb-2">
            Platform Stats
          </h1>
          <p className="text-text-muted font-body-sm text-body-sm max-w-xl">
            Live figures read directly from the Veritine contract on GenLayer &mdash; the same numbers described in
            the docs, but current.
          </p>
        </section>

        {!stats && (
          <div className="bg-surface ghost-border rounded-lg p-stack-lg text-center text-text-muted mb-stack-lg">
            Unable to reach the contract right now &mdash; figures below may be unavailable.
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-md mb-stack-lg">
          <StatTile label="TOTAL DISPUTES" value={stats ? String(stats.dispute_count) : '—'} />
          <StatTile label="ADJUDICATED" value={stats ? String(stats.total_disputes_adjudicated) : '—'} />
          <StatTile label="EVIDENCE SUBMITTED" value={stats ? String(stats.evidence_count) : '—'} />
          <StatTile
            label="PLATFORM STATUS"
            value={stats ? (stats.paused ? 'PAUSED' : 'ACTIVE') : '—'}
            tone={stats?.paused ? 'text-slashed' : 'text-verified'}
          />
          <StatTile label="TOTAL VOLUME" value={stats ? `${formatGen(stats.total_volume_wei)} GEN` : '—'} />
          <StatTile label="TOTAL PAYOUTS" value={stats ? `${formatGen(stats.total_payouts_wei)} GEN` : '—'} />
          <StatTile label="TREASURY BALANCE" value={stats ? `${formatGen(stats.accrued_treasury_wei)} GEN` : '—'} />
          <StatTile label="PROTOCOL FEE" value={config ? bpsToPct(config.protocol_fee_bps) : '—'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-stack-lg mb-stack-lg">
          <section className="bg-surface p-stack-md ghost-border rounded-lg">
            <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
              PROTOCOL CONFIG
            </h2>
            {!config && <p className="text-text-muted text-body-sm">Unavailable.</p>}
            {config && (
              <div className="space-y-stack-sm text-body-sm">
                <Row label="Min position stake" value={`${formatGen(config.min_position_stake_wei)} GEN`} />
                <Row label="Min evidence stake" value={`${formatGen(config.min_evidence_stake_wei)} GEN`} />
                <Row label="Positions per dispute" value={`${config.min_positions_per_dispute}–${config.max_positions_per_dispute}`} />
                <Row label="Max evidence per dispute" value={String(config.max_evidence_per_dispute)} />
                <Row label="Adjudication timeout" value={`${Math.round(config.adjudication_timeout_seconds / 3600)}h`} />
                <Row label="Slash → winners share" value={bpsToPct(config.slash_winner_share_bps)} />
                <Row label="Slash → treasury share" value={bpsToPct(config.slash_treasury_share_bps)} />
              </div>
            )}
          </section>

          <section className="bg-surface p-stack-md ghost-border rounded-lg">
            <h2 className="font-label-caps text-label-caps text-on-surface mb-stack-md border-b border-border-subtle pb-2">
              EVIDENCE OUTCOME ECONOMICS
            </h2>
            {!economics && <p className="text-text-muted text-body-sm">Unavailable.</p>}
            {economics && (
              <div className="space-y-1 text-body-sm">
                {Object.entries(economics.slash_bps_by_outcome).map(([outcome, bps]) => {
                  const rewardEligible = economics.reward_eligible_outcomes.includes(outcome);
                  return (
                    <div key={outcome} className="flex justify-between items-center py-1 border-b border-border-subtle/50 last:border-0">
                      <span className="text-on-surface-variant">
                        {outcome.replace(/_/g, ' ')}
                        {rewardEligible && <span className="ml-2 text-[10px] text-verified">REWARD-ELIGIBLE</span>}
                      </span>
                      <span className={`font-code-sm ${bps === 0 ? 'text-verified' : bps >= 10000 ? 'text-slashed' : 'text-pending'}`}>
                        {bpsToPct(bps)} slash
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: string }): React.ReactElement {
  return (
    <div className="bg-surface ghost-border p-stack-md rounded-lg">
      <div className="text-on-surface-variant font-label-caps text-label-caps mb-1">{label}</div>
      <div className={`font-headline-lg-mobile text-headline-lg-mobile ${tone ?? 'text-on-surface'}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between items-center">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-code-sm text-on-surface">{value}</span>
    </div>
  );
}
