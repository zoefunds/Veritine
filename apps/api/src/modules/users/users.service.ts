import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  /**
   * Finds the user for an authenticated wallet address, creating one on
   * first sign-in. This is the only place a User row gets created -
   * account creation is implicit in successful wallet authentication,
   * there is no separate "register" step for wallet-based auth.
   */
  async findOrCreateByWalletAddress(address: string, chainId: string): Promise<User> {
    const normalized = address.toLowerCase();
    const existing = await this.usersRepository.findByWalletAddress(normalized);
    if (existing) {
      return existing;
    }
    return this.usersRepository.createWithWallet(normalized, chainId);
  }

  getById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }
}
