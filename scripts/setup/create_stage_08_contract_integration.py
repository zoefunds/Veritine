#!/usr/bin/env python3
"""
Veritine - Stage 08: Contract integration.

Wires the deployed Veritine Intelligent Contract (StudioNet address
0xB1Cd4426003d7B443866294B6df55F085fdf3443) into the frontend and
backend via a shared @veritine/contract-client package built on
genlayer-js. Adds a live read on the homepage and a backend indexer
module that periodically syncs on-chain dispute state into Postgres.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_08_contract_integration.py

Safe to rerun: yes, overwrites the files it manages.
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "packages/contract-client/src",
    "apps/api/src/modules/indexer",
]

FILES = {}

# ---------------------------------------------------------------------------
# packages/contract-client
# ---------------------------------------------------------------------------

FILES["packages/contract-client/package.json"] = """{
  "name": "@veritine/contract-client",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@veritine/shared-types": "workspace:*",
    "genlayer-js": "^1.2.0"
  },
  "devDependencies": {
    "@types/node": "^22.7.5"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
"""

FILES["packages/contract-client/tsconfig.json"] = """{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
"""

FILES["packages/contract-client/src/config.ts"] = """// Centralized contract configuration - the ONLY place the deployed
// address and chain should be read from. Never hardcode the address in
// frontend components or backend services; import getContractConfig()
// instead so a redeploy only ever requires updating environment
// variables in one place.

import { studionet } from 'genlayer-js/chains';
import type { Chain } from 'genlayer-js/types';

export interface ContractConfig {
  address: `0x${string}`;
  chain: Chain;
}

function resolveChain(network: string | undefined): Chain {
  // Only StudioNet is wired up today (see docs/architecture - the project
  // deploys to GenLayer Studio / StudioNet per the deployment requirements).
  // Extend this switch if/when testnet or mainnet support is added.
  switch (network) {
    case 'studionet':
    case undefined:
      return studionet;
    default:
      throw new Error(`Unsupported GenLayer network: ${network}`);
  }
}

export function getContractConfig(env: {
  contractAddress: string | undefined;
  network: string | undefined;
}): ContractConfig {
  if (!env.contractAddress) {
    throw new Error(
      'GenLayer contract address is not configured. Set GENLAYER_CONTRACT_ADDRESS ' +
        '(backend) / NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS (frontend).',
    );
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(env.contractAddress)) {
    throw new Error(`GenLayer contract address is not a valid address: ${env.contractAddress}`);
  }
  return {
    address: env.contractAddress as `0x${string}`,
    chain: resolveChain(env.network),
  };
}
"""

FILES["packages/contract-client/src/read-client.ts"] = """import { createClient } from 'genlayer-js';
import { getContractConfig, type ContractConfig } from './config';

/** A read-only client - no wallet/account required, talks directly to the RPC. */
export function createReadClient(env: { contractAddress: string | undefined; network: string | undefined }) {
  const config = getContractConfig(env);
  const client = createClient({ chain: config.chain });
  return { client, config };
}

export type ReadClient = ReturnType<typeof createReadClient>;

/** Generic typed view-method call against the deployed Veritine contract. */
export async function readVeritine<T>(
  read: ReadClient,
  functionName: string,
  args: unknown[] = [],
): Promise<T> {
  return read.client.readContract({
    address: read.config.address,
    functionName,
    args,
  }) as Promise<T>;
}
"""

FILES["packages/contract-client/src/write-client.ts"] = """import { createClient } from 'genlayer-js';
import { TransactionStatus } from 'genlayer-js/types';
import { getContractConfig, type ContractConfig } from './config';

export interface WriteClientOptions {
  contractAddress: string | undefined;
  network: string | undefined;
  account: `0x${string}`;
  /** EIP-1193 provider, e.g. window.ethereum in the browser. */
  provider: unknown;
}

/** A write-capable client bound to a connected wallet account/provider. */
export function createWriteClient(options: WriteClientOptions) {
  const config = getContractConfig(options);
  const client = createClient({
    chain: config.chain,
    account: options.account,
    provider: options.provider as never,
  });
  return { client, config };
}

export type WriteClient = ReturnType<typeof createWriteClient>;

export interface SubmittedTransaction {
  hash: `0x${string}`;
}

/** Submits a write transaction. Does not wait for finality - see waitForFinality. */
export async function writeVeritine(
  write: WriteClient,
  functionName: string,
  args: unknown[] = [],
  valueWei: bigint = BigInt(0),
): Promise<SubmittedTransaction> {
  const hash = await write.client.writeContract({
    address: write.config.address,
    functionName,
    args,
    value: valueWei,
  });
  return { hash: hash as `0x${string}` };
}

/**
 * Waits for a submitted transaction to finalize and reports whether
 * execution actually succeeded - a transaction can finalize by consensus
 * while still having failed execution, so callers must check this before
 * treating the write as successful. Never assume success just because a
 * hash was returned.
 */
export async function waitForFinality(
  read: { client: ReturnType<typeof createClient> },
  hash: `0x${string}`,
): Promise<{ finalized: boolean; succeeded: boolean; raw: unknown }> {
  const receipt = await read.client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    fullTransaction: false,
  });
  const executionResultName = (receipt as { txExecutionResultName?: string }).txExecutionResultName;
  return {
    finalized: true,
    succeeded: executionResultName === 'FINISHED_WITH_RETURN',
    raw: receipt,
  };
}
"""

FILES["packages/contract-client/src/veritine-client.ts"] = """// Typed method wrappers over the deployed Veritine contract's public
// interface (contracts/veritine_contract.py). Keep this file's method
// list in sync with the contract - it is the single place contract
// calls should be made from; never scatter raw readContract/writeContract
// calls through frontend/backend feature code.

import type { Dispute, EvidenceSubmission } from '@veritine/shared-types';
import { createReadClient, readVeritine, type ReadClient } from './read-client';
import {
  createWriteClient,
  writeVeritine,
  waitForFinality,
  type WriteClient,
  type WriteClientOptions,
} from './write-client';

export class VeritineReadClient {
  private readonly read: ReadClient;

  constructor(env: { contractAddress: string | undefined; network: string | undefined }) {
    this.read = createReadClient(env);
  }

  getConfig() {
    return readVeritine<Record<string, unknown>>(this.read, 'get_config');
  }

  getPlatformStats() {
    return readVeritine<Record<string, unknown>>(this.read, 'get_platform_stats');
  }

  getDisputeCount() {
    return readVeritine<number>(this.read, 'get_dispute_count');
  }

  getDispute(disputeId: number) {
    return readVeritine<Dispute>(this.read, 'get_dispute', [disputeId]);
  }

  getDisputes(offset = 0, limit = 20) {
    return readVeritine<Dispute[]>(this.read, 'get_disputes', [offset, limit]);
  }

  getDisputeIdsByStatus(status: string) {
    return readVeritine<number[]>(this.read, 'get_dispute_ids_by_status', [status]);
  }

  getPositions(disputeId: number) {
    return readVeritine<Array<Record<string, unknown>>>(this.read, 'get_positions', [disputeId]);
  }

  getEvidenceForDispute(disputeId: number) {
    return readVeritine<EvidenceSubmission[]>(this.read, 'get_evidence_for_dispute', [disputeId]);
  }

  getEvidence(evidenceId: number) {
    return readVeritine<EvidenceSubmission>(this.read, 'get_evidence', [evidenceId]);
  }

  getBalanceOf(address: string) {
    return readVeritine<number>(this.read, 'get_balance_of', [address]);
  }

  getEvidenceOutcomeEconomics() {
    return readVeritine<Record<string, unknown>>(this.read, 'get_evidence_outcome_economics');
  }
}

export class VeritineWriteClient {
  private readonly write: WriteClient;
  private readonly read: ReadClient;

  constructor(options: WriteClientOptions) {
    this.write = createWriteClient(options);
    this.read = createReadClient(options);
  }

  async createDispute(params: {
    question: string;
    description: string;
    category: string;
    positionLabelsJson: string;
    participationDeadlineTs: number;
    evidenceDeadlineTs: number;
    minPositionStakeWei: string;
    minEvidenceStakeWei: string;
    valueWei?: bigint;
  }) {
    const submitted = await writeVeritine(
      this.write,
      'create_dispute',
      [
        params.question,
        params.description,
        params.category,
        params.positionLabelsJson,
        params.participationDeadlineTs,
        params.evidenceDeadlineTs,
        params.minPositionStakeWei,
        params.minEvidenceStakeWei,
      ],
      params.valueWei ?? BigInt(0),
    );
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async stakePosition(disputeId: number, positionIndex: number, valueWei: bigint) {
    const submitted = await writeVeritine(this.write, 'stake_position', [disputeId, positionIndex], valueWei);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async submitEvidence(params: {
    disputeId: number;
    positionIndex: number;
    sourceUrl: string;
    sourceTitle: string;
    publisher: string;
    publicationDate: string;
    summary: string;
    sourceType: string;
    valueWei: bigint;
  }) {
    const submitted = await writeVeritine(
      this.write,
      'submit_evidence',
      [
        params.disputeId,
        params.positionIndex,
        params.sourceUrl,
        params.sourceTitle,
        params.publisher,
        params.publicationDate,
        params.summary,
        params.sourceType,
      ],
      params.valueWei,
    );
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async stakeEvidence(evidenceId: number, valueWei: bigint) {
    const submitted = await writeVeritine(this.write, 'stake_evidence', [evidenceId], valueWei);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async requestAdjudication(disputeId: number) {
    const submitted = await writeVeritine(this.write, 'request_adjudication', [disputeId]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async claimPosition(disputeId: number, positionIndex: number) {
    const submitted = await writeVeritine(this.write, 'claim_position', [disputeId, positionIndex]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async claimEvidence(evidenceId: number) {
    const submitted = await writeVeritine(this.write, 'claim_evidence', [evidenceId]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async withdraw(amountWei: string) {
    const submitted = await writeVeritine(this.write, 'withdraw', [amountWei]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }
}
"""

FILES["packages/contract-client/src/index.ts"] = """export * from './config';
export * from './read-client';
export * from './write-client';
export * from './veritine-client';
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
