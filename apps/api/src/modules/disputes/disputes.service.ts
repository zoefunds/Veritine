import { Injectable } from '@nestjs/common';
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
