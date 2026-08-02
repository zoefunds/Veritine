import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
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
