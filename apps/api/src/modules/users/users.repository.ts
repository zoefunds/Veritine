import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../shared/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByWalletAddress(address: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { primaryWalletAddress: address } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findActivityByWalletAddress(address: string) {
    return this.prisma.user.findUnique({
      where: { primaryWalletAddress: address },
      include: {
        positionStakes: {
          include: { dispute: true, position: true },
          orderBy: { createdAt: 'desc' },
        },
        evidenceSubmitted: {
          include: { dispute: true, position: true },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });
  }

  createWithWallet(address: string, chainId: string): Promise<User> {
    return this.prisma.user.create({
      data: {
        primaryWalletAddress: address,
        wallets: {
          create: { address, chainId, verifiedAt: new Date() },
        },
      },
    });
  }
}
