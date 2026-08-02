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
}
