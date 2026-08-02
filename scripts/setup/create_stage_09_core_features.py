#!/usr/bin/env python3
"""
Veritine - Stage 09: Core product features.

Backend: a DisputesModule exposing read endpoints over the indexed
Postgres mirror (disputes, positions, evidence) with pagination and
status/category filters.

Frontend: real, functional (not yet visually polished - that's Phase 10)
pages for browsing disputes, viewing a dispute's detail, creating a
dispute, staking on a position, and submitting evidence - every write
goes through the connected wallet and @veritine/contract-client, calling
the real deployed contract. No mocked transactions anywhere.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_09_core_features.py

Safe to rerun: yes, overwrites the files it manages.
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "apps/api/src/modules/disputes",
    "apps/web/app/disputes",
    "apps/web/app/disputes/create",
    "apps/web/app/disputes/[id]",
    "apps/web/hooks",
]

FILES = {}

# ---------------------------------------------------------------------------
# Backend: DisputesModule (read endpoints over the indexed mirror)
# ---------------------------------------------------------------------------

FILES["apps/api/src/modules/disputes/disputes.service.ts"] = """import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { DisputeCategory, DisputeStatus, Prisma } from '@prisma/client';

export interface ListDisputesParams {
  offset: number;
  limit: number;
  status?: DisputeStatus;
  category?: DisputeCategory;
  search?: string;
}

@Injectable()
export class DisputesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListDisputesParams) {
    const where: Prisma.DisputeWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.category) where.category = params.category;
    if (params.search) {
      where.question = { contains: params.search, mode: 'insensitive' };
    }

    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where,
        include: { positions: true, creator: true },
        orderBy: { createdAt: 'desc' },
        skip: params.offset,
        take: params.limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return { items, total };
  }

  async getByContractId(contractDisputeId: string) {
    return this.prisma.dispute.findUnique({
      where: { contractDisputeId },
      include: {
        positions: true,
        creator: true,
        evidence: { include: { submitter: true } },
        adjudicationResult: { include: { evidenceVerdicts: true } },
      },
    });
  }
}
"""

FILES["apps/api/src/modules/disputes/disputes.controller.ts"] = """import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { DisputeCategory, DisputeStatus } from '@prisma/client';
import { DisputesService } from './disputes.service';

@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get()
  async list(
    @Query('offset') offset = '0',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const parsedStatus =
      status && (Object.values(DisputeStatus) as string[]).includes(status)
        ? (status as DisputeStatus)
        : undefined;
    const parsedCategory =
      category && (Object.values(DisputeCategory) as string[]).includes(category)
        ? (category as DisputeCategory)
        : undefined;

    const { items, total } = await this.disputesService.list({
      offset: Math.max(0, Number(offset) || 0),
      limit: Math.min(50, Math.max(1, Number(limit) || 20)),
      status: parsedStatus,
      category: parsedCategory,
      search,
    });

    return {
      items: items.map((d) => ({
        id: d.contractDisputeId,
        question: d.question,
        category: d.category,
        status: d.status,
        totalStakeWei: d.totalStakeWei,
        participationDeadline: d.participationDeadline,
        evidenceDeadline: d.evidenceDeadline,
        positions: d.positions.map((p) => ({ label: p.label, totalStakeWei: p.totalStakeWei })),
        creator: d.creator.primaryWalletAddress,
      })),
      total,
    };
  }

  @Get(':contractDisputeId')
  async getOne(@Param('contractDisputeId') contractDisputeId: string) {
    const dispute = await this.disputesService.getByContractId(contractDisputeId);
    if (!dispute) {
      throw new NotFoundException(`Dispute ${contractDisputeId} not found`);
    }
    return {
      id: dispute.contractDisputeId,
      question: dispute.question,
      description: dispute.description,
      category: dispute.category,
      status: dispute.status,
      totalStakeWei: dispute.totalStakeWei,
      participationDeadline: dispute.participationDeadline,
      evidenceDeadline: dispute.evidenceDeadline,
      creator: dispute.creator.primaryWalletAddress,
      positions: dispute.positions.map((p) => ({
        contractPositionId: p.contractPositionId,
        label: p.label,
        totalStakeWei: p.totalStakeWei,
      })),
      evidence: dispute.evidence.map((e) => ({
        id: e.contractEvidenceId,
        positionId: e.positionId,
        sourceUrl: e.sourceUrl,
        sourceTitle: e.sourceTitle,
        publisher: e.publisher,
        summary: e.summary,
        totalStakeWei: e.totalStakeWei,
        outcome: e.outcome,
        submitter: e.submitter.primaryWalletAddress,
      })),
      adjudication: dispute.adjudicationResult
        ? {
            conclusion: dispute.adjudicationResult.conclusion,
            reasoningSummary: dispute.adjudicationResult.reasoningSummary,
            adjudicatedAt: dispute.adjudicationResult.adjudicatedAt,
          }
        : null,
    };
  }
}
"""

FILES["apps/api/src/modules/disputes/disputes.module.ts"] = """import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  controllers: [DisputesController],
  providers: [PrismaService, DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
"""

# ---------------------------------------------------------------------------
# Frontend: dispute browsing, detail, creation
# ---------------------------------------------------------------------------

FILES["apps/web/hooks/useVeritineWrite.ts"] = """'use client';

import { useCallback, useState } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import { VeritineWriteClient } from '@veritine/contract-client';

type WriteStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

/**
 * Provides a VeritineWriteClient bound to the connected wallet, plus
 * lifecycle state (pending/confirming/success/error) for the calling
 * component to render. Every write goes through the real deployed
 * contract - there is no mocked transaction path.
 */
export function useVeritineWrite() {
  const { address, isConnected } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const [status, setStatus] = useState<WriteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const getClient = useCallback((): VeritineWriteClient => {
    if (!isConnected || !address) {
      throw new Error('Connect a wallet first');
    }
    const provider = (connectorClient as unknown as { transport?: unknown })?.transport;
    return new VeritineWriteClient({
      contractAddress: process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS,
      network: process.env.NEXT_PUBLIC_GENLAYER_NETWORK,
      account: address,
      provider: (typeof window !== 'undefined' ? (window as unknown as { ethereum?: unknown }).ethereum : provider) as unknown,
    });
  }, [address, isConnected, connectorClient]);

  const run = useCallback(
    async <T extends { hash: string; waitForFinality: () => Promise<{ succeeded: boolean }> }>(
      action: (client: VeritineWriteClient) => Promise<T>,
    ): Promise<T | null> => {
      setError(null);
      setTxHash(null);
      try {
        setStatus('pending');
        const client = getClient();
        const submitted = await action(client);
        setTxHash(submitted.hash);
        setStatus('confirming');
        const result = await submitted.waitForFinality();
        setStatus(result.succeeded ? 'success' : 'error');
        if (!result.succeeded) {
          setError('Transaction finalized but execution failed on-chain');
        }
        return submitted;
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Transaction failed');
        return null;
      }
    },
    [getClient],
  );

  return { run, status, error, txHash };
}
"""

FILES["apps/web/lib/parse-gen.ts"] = """/** Parses a user-entered GEN amount (e.g. "1.5") into a wei bigint. */
export function parseGen(genAmount: string): bigint {
  const trimmed = genAmount.trim();
  if (!trimmed || Number.isNaN(Number(trimmed)) || Number(trimmed) < 0) {
    throw new Error('Enter a valid, non-negative GEN amount');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const paddedFraction = (fraction + '0'.repeat(18)).slice(0, 18);
  const wholePart = BigInt(whole || '0') * BigInt(10) ** BigInt(18);
  const fractionPart = BigInt(paddedFraction || '0');
  return wholePart + fractionPart;
}
"""

FILES["apps/web/app/disputes/page.tsx"] = """import Link from 'next/link';
import { formatGen } from '../../lib/format-gen';

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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  try {
    const res = await fetch(`${apiUrl}/disputes?limit=20`, { cache: 'no-store' });
    if (!res.ok) return [];
    const body = await res.json();
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
"""

FILES["apps/web/app/disputes/[id]/DisputeDetailClient.tsx"] = """'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';

interface Position {
  contractPositionId: string;
  label: string;
  totalStakeWei: string;
}

export function StakePositionForm({
  disputeContractId,
  positions,
}: {
  disputeContractId: string;
  positions: Position[];
}): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const [positionIndex, setPositionIndex] = useState(0);
  const [amount, setAmount] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let weiAmount: bigint;
    try {
      weiAmount = parseGen(amount);
    } catch {
      return;
    }
    await run((client) => client.stakePosition(Number(disputeContractId), positionIndex, weiAmount));
  };

  if (!isConnected) {
    return <p style={{ color: 'var(--text-muted)' }}>Connect a wallet to stake on a position.</p>;
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '360px' }}>
      <select
        value={positionIndex}
        onChange={(e) => setPositionIndex(Number(e.target.value))}
        style={{ padding: '0.5rem', background: 'var(--surface-container-lowest)', color: 'inherit', border: '1px solid var(--border-subtle)' }}
      >
        {positions.map((p, i) => (
          <option key={p.contractPositionId} value={i}>
            {p.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Amount in GEN"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ padding: '0.5rem', background: 'var(--surface-container-lowest)', color: 'inherit', border: '1px solid var(--border-subtle)' }}
      />
      <button
        type="submit"
        disabled={status === 'pending' || status === 'confirming'}
        style={{ padding: '0.5rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)' }}
      >
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Stake on Position'}
      </button>
      {status === 'success' && <p style={{ color: 'var(--verified)', fontSize: '0.875rem' }}>Confirmed: {txHash}</p>}
      {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
    </form>
  );
}

export function SubmitEvidenceForm({
  disputeContractId,
  positions,
}: {
  disputeContractId: string;
  positions: Position[];
}): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();
  const [positionIndex, setPositionIndex] = useState(0);
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [publisher, setPublisher] = useState('');
  const [summary, setSummary] = useState('');
  const [sourceType, setSourceType] = useState('REPUTABLE_JOURNALISM');
  const [amount, setAmount] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    let weiAmount: bigint;
    try {
      weiAmount = parseGen(amount);
    } catch {
      return;
    }
    await run((client) =>
      client.submitEvidence({
        disputeId: Number(disputeContractId),
        positionIndex,
        sourceUrl,
        sourceTitle,
        publisher,
        publicationDate: '',
        summary,
        sourceType,
        valueWei: weiAmount,
      }),
    );
  };

  if (!isConnected) {
    return <p style={{ color: 'var(--text-muted)' }}>Connect a wallet to submit evidence.</p>;
  }

  const inputStyle = {
    padding: '0.5rem',
    background: 'var(--surface-container-lowest)',
    color: 'inherit',
    border: '1px solid var(--border-subtle)',
  } as const;

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '480px' }}>
      <select value={positionIndex} onChange={(e) => setPositionIndex(Number(e.target.value))} style={inputStyle}>
        {positions.map((p, i) => (
          <option key={p.contractPositionId} value={i}>
            Supports: {p.label}
          </option>
        ))}
      </select>
      <input type="url" placeholder="Source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={inputStyle} required />
      <input type="text" placeholder="Source title" value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} style={inputStyle} required />
      <input type="text" placeholder="Publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} style={inputStyle} required />
      <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} style={inputStyle}>
        {[
          'PRIMARY_SOURCE',
          'OFFICIAL_REPORT',
          'REGULATORY_FILING',
          'GOVERNMENT_RECORD',
          'PEER_REVIEWED_RESEARCH',
          'INDEPENDENT_INVESTIGATION',
          'REPUTABLE_JOURNALISM',
          'ORGANIZATIONAL_PUBLICATION',
          'COMMUNITY_GENERATED',
          'SOCIAL_MEDIA',
          'ARCHIVED_SOURCE',
          'ANONYMOUS_SOURCE',
        ].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <textarea
        placeholder="How does this evidence support the position? (min 20 chars)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        style={{ ...inputStyle, minHeight: '80px' }}
        required
      />
      <input type="text" placeholder="Stake amount in GEN" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} required />
      <button
        type="submit"
        disabled={status === 'pending' || status === 'confirming'}
        style={{ padding: '0.5rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)' }}
      >
        {status === 'pending' && 'Submitting...'}
        {status === 'confirming' && 'Waiting for finality...'}
        {(status === 'idle' || status === 'success' || status === 'error') && 'Submit Evidence'}
      </button>
      {status === 'success' && <p style={{ color: 'var(--verified)', fontSize: '0.875rem' }}>Confirmed: {txHash}</p>}
      {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
    </form>
  );
}
"""

FILES["apps/web/app/disputes/[id]/page.tsx"] = """import { formatGen } from '../../../lib/format-gen';
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  try {
    const res = await fetch(`${apiUrl}/disputes/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
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
"""

FILES["apps/web/app/disputes/create/page.tsx"] = """'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useVeritineWrite } from '../../../hooks/useVeritineWrite';
import { parseGen } from '../../../lib/parse-gen';

const CATEGORIES = ['CLIMATE', 'GOVERNANCE', 'TECH', 'MEDIA', 'FINANCE', 'PUBLIC_HEALTH', 'OTHER'];

export default function CreateDisputePage(): React.ReactElement {
  const { isConnected } = useAccount();
  const { run, status, error, txHash } = useVeritineWrite();

  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [positionA, setPositionA] = useState('Yes');
  const [positionB, setPositionB] = useState('No');
  const [participationDays, setParticipationDays] = useState('7');
  const [evidenceDays, setEvidenceDays] = useState('14');
  const [minPositionStake, setMinPositionStake] = useState('0');
  const [minEvidenceStake, setMinEvidenceStake] = useState('0');

  const inputStyle = {
    padding: '0.5rem',
    background: 'var(--surface-container-lowest)',
    color: 'inherit',
    border: '1px solid var(--border-subtle)',
  } as const;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = Math.floor(Date.now() / 1000);
    const participationDeadlineTs = now + Number(participationDays) * 86400;
    const evidenceDeadlineTs = now + Number(evidenceDays) * 86400;

    let minPositionWei: bigint;
    let minEvidenceWei: bigint;
    try {
      minPositionWei = parseGen(minPositionStake || '0');
      minEvidenceWei = parseGen(minEvidenceStake || '0');
    } catch {
      return;
    }

    await run((client) =>
      client.createDispute({
        question,
        description,
        category,
        positionLabelsJson: JSON.stringify([positionA, positionB]),
        participationDeadlineTs,
        evidenceDeadlineTs,
        minPositionStakeWei: minPositionWei.toString(),
        minEvidenceStakeWei: minEvidenceWei.toString(),
      }),
    );
  };

  return (
    <main style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Create a Dispute</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        The question must be factually adjudicable - specific enough to evaluate against evidence. Unsupported
        opinions or ambiguous claims will produce inconclusive results.
      </p>

      {!isConnected ? (
        <p style={{ color: 'var(--text-muted)' }}>Connect a wallet to create a dispute.</p>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            placeholder="Dispute question (e.g. 'Did Company X reduce emissions by 40%?')"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            style={{ ...inputStyle, minHeight: '60px' }}
            required
          />
          <textarea
            placeholder="Additional context"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ ...inputStyle, minHeight: '80px' }}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input placeholder="Position A label" value={positionA} onChange={(e) => setPositionA(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
            <input placeholder="Position B label" value={positionB} onChange={(e) => setPositionB(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Participation window (days)
              <input type="number" min="1" value={participationDays} onChange={(e) => setParticipationDays(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Evidence window (days)
              <input type="number" min="1" value={evidenceDays} onChange={(e) => setEvidenceDays(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Min position stake (GEN)
              <input value={minPositionStake} onChange={(e) => setMinPositionStake(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
            <label style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Min evidence stake (GEN)
              <input value={minEvidenceStake} onChange={(e) => setMinEvidenceStake(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
            </label>
          </div>
          <button
            type="submit"
            disabled={status === 'pending' || status === 'confirming'}
            style={{ padding: '0.75rem', background: 'var(--primary-container)', color: 'var(--on-primary-container)', border: 'none', borderRadius: 'var(--radius-md)' }}
          >
            {status === 'pending' && 'Submitting...'}
            {status === 'confirming' && 'Waiting for finality...'}
            {(status === 'idle' || status === 'success' || status === 'error') && 'Create Dispute'}
          </button>
          {status === 'success' && <p style={{ color: 'var(--verified)', fontSize: '0.875rem' }}>Confirmed: {txHash}</p>}
          {error && <p style={{ color: 'var(--slashed)', fontSize: '0.875rem' }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
"""


def main():
    for d in DIRS:
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)

    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)

    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
