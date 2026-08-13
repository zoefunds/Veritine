// Typed method wrappers over the deployed Veritine contract's public
// interface (contracts/veritine_contract.py). Keep this file's method
// list in sync with the contract - it is the single place contract
// calls should be made from; never scatter raw readContract/writeContract
// calls through frontend/backend feature code.

import type { Dispute, EvidenceSubmission } from '@veritine/shared-types';
import { createReadClient, readVeritine, type ReadClient } from './read-client.js';
import {
  createWriteClient,
  createServerWriteClient,
  writeVeritine,
  waitForFinality,
  type WriteClient,
  type WriteClientOptions,
  type ServerWriteClientOptions,
} from './write-client.js';

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

  getActivity(disputeId: number, offset = 0, limit = 25) {
    return readVeritine<Array<{ kind: string; actor: string; amount_wei: number; ts: number; note: string }>>(
      this.read,
      'get_activity',
      [disputeId, offset, limit],
    );
  }

  getPositionStake(disputeId: number, positionIndex: number, address: string) {
    return readVeritine<{ amount_wei: number; claimed: boolean }>(this.read, 'get_position_stake', [
      disputeId,
      positionIndex,
      address,
    ]);
  }

  getEvidenceOutcomeEconomics() {
    return readVeritine<Record<string, unknown>>(this.read, 'get_evidence_outcome_economics');
  }

  getFlagCount(address: string) {
    return readVeritine<number>(this.read, 'get_flag_count', [address]);
  }

  getEvidenceStake(evidenceId: number, address: string) {
    return readVeritine<{ amount_wei: number; claimed: boolean }>(this.read, 'get_evidence_stake', [
      evidenceId,
      address,
    ]);
  }

  getCategories() {
    return readVeritine<string[]>(this.read, 'get_categories');
  }
}

export class VeritineWriteClient {
  private readonly write: WriteClient;
  private readonly read: ReadClient;

  /**
   * Accepts either a browser-wallet-bound config (account + EIP-1193
   * provider) or a server-held private key for operational bots (e.g.
   * the adjudication resolver) - see createServerWriteClient's docstring
   * for why the latter must never be used for anything representing a
   * user's own funds/actions.
   */
  constructor(options: WriteClientOptions | ServerWriteClientOptions) {
    this.write = 'privateKey' in options ? createServerWriteClient(options) : createWriteClient(options);
    this.read = createReadClient(options);
  }

  async createDispute(params: {
    question: string;
    description: string;
    category: string;
    positionLabelsJson: string;
    participationDeadlineTs: number;
    evidenceDeadlineTs: number;
    minPositionStakeWei: bigint;
    minEvidenceStakeWei: bigint;
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

  /**
   * Creator-only before any other participation (no other position
   * stakes, no evidence beyond the creator's own initial stake), or
   * owner as an emergency override on any ACTIVE/EVIDENCE_CLOSED
   * dispute. The contract enforces both cases - this is not a
   * client-side-only check.
   */
  async cancelDispute(disputeId: number) {
    const submitted = await writeVeritine(this.write, 'cancel_dispute', [disputeId]);
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

  /**
   * Moves accrued treasury funds (protocol fees + the treasury's share of
   * slashed evidence stakes) into the treasury address's withdrawable
   * balance. Deliberately permissionless on the contract (see
   * sweep_treasury's docstring) - anyone can call it, not just the owner -
   * only where the funds land (set_treasury_address) is owner-gated.
   */
  async sweepTreasury() {
    const submitted = await writeVeritine(this.write, 'sweep_treasury', []);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async pause() {
    const submitted = await writeVeritine(this.write, 'pause', []);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async unpause() {
    const submitted = await writeVeritine(this.write, 'unpause', []);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async setFees(protocolFeeBps: number, slashWinnerShareBps: number) {
    const submitted = await writeVeritine(this.write, 'set_fees', [protocolFeeBps, slashWinnerShareBps]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async setMinimums(minPositionStakeWei: bigint, minEvidenceStakeWei: bigint) {
    const submitted = await writeVeritine(this.write, 'set_minimums', [minPositionStakeWei, minEvidenceStakeWei]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }

  async setTreasuryAddress(newTreasuryAddress: string) {
    const submitted = await writeVeritine(this.write, 'set_treasury_address', [newTreasuryAddress]);
    return { ...submitted, waitForFinality: () => waitForFinality(this.read, submitted.hash) };
  }
}
