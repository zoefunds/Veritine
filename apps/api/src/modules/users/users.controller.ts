import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    const user = await this.usersService.getById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return {
      id: user.id,
      primaryWalletAddress: user.primaryWalletAddress,
      displayName: user.displayName,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  /**
   * A connected wallet's position stakes and evidence submissions across
   * every dispute - powers the "My Activity" section of the dashboard so
   * users can find what they've already staked/submitted without hunting
   * through the explorer. Returns empty arrays (not 404) for a wallet
   * that has never interacted with the platform - that's a normal state,
   * not an error.
   */
  @Get('by-wallet/:address/activity')
  async getActivityByWallet(@Param('address') address: string) {
    const user = await this.usersService.getActivityByWalletAddress(address);
    if (!user) {
      return { positions: [], evidence: [] };
    }
    return {
      positions: user.positionStakes.map((stake) => ({
        id: stake.id,
        disputeId: stake.dispute.contractDisputeId,
        disputeQuestion: stake.dispute.question,
        disputeStatus: stake.dispute.status,
        positionLabel: stake.position.label,
        amountWei: stake.amountWei,
        status: stake.status,
        createdAt: stake.createdAt,
      })),
      evidence: user.evidenceSubmitted.map((evidence) => ({
        id: evidence.id,
        disputeId: evidence.dispute.contractDisputeId,
        disputeQuestion: evidence.dispute.question,
        disputeStatus: evidence.dispute.status,
        positionLabel: evidence.position.label,
        sourceUrl: evidence.sourceUrl,
        sourceTitle: evidence.sourceTitle,
        submitterStakeWei: evidence.submitterStakeWei,
        outcome: evidence.outcome,
        verificationStatus: evidence.verificationStatus,
        submittedAt: evidence.submittedAt,
      })),
    };
  }
}
