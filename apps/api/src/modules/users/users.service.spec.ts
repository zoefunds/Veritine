import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import type { User } from '@prisma/client';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    primaryWalletAddress: '0xabc0000000000000000000000000000000abcd',
    displayName: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

describe('UsersService', () => {
  let repository: jest.Mocked<UsersRepository>;
  let service: UsersService;

  beforeEach(() => {
    repository = {
      findByWalletAddress: jest.fn(),
      findById: jest.fn(),
      createWithWallet: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;
    service = new UsersService(repository);
  });

  describe('findOrCreateByWalletAddress', () => {
    it('returns the existing user without creating a new one', async () => {
      const existing = makeUser();
      repository.findByWalletAddress.mockResolvedValue(existing);

      const result = await service.findOrCreateByWalletAddress('0xABC0000000000000000000000000000000ABCD', 'genlayer-studionet');

      expect(result).toBe(existing);
      expect(repository.createWithWallet).not.toHaveBeenCalled();
    });

    it('normalizes the address to lowercase before lookup', async () => {
      repository.findByWalletAddress.mockResolvedValue(makeUser());

      await service.findOrCreateByWalletAddress('0xABC0000000000000000000000000000000ABCD', 'genlayer-studionet');

      expect(repository.findByWalletAddress).toHaveBeenCalledWith('0xabc0000000000000000000000000000000abcd');
    });

    it('creates a new user when none exists for the address', async () => {
      repository.findByWalletAddress.mockResolvedValue(null);
      const created = makeUser({ id: 'user-2' });
      repository.createWithWallet.mockResolvedValue(created);

      const result = await service.findOrCreateByWalletAddress('0xdef0000000000000000000000000000000dead', 'genlayer-studionet');

      expect(result).toBe(created);
      expect(repository.createWithWallet).toHaveBeenCalledWith(
        '0xdef0000000000000000000000000000000dead',
        'genlayer-studionet',
      );
    });
  });

  describe('getById', () => {
    it('delegates to the repository', async () => {
      const user = makeUser();
      repository.findById.mockResolvedValue(user);

      const result = await service.getById('user-1');

      expect(result).toBe(user);
      expect(repository.findById).toHaveBeenCalledWith('user-1');
    });

    it('returns null when the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.getById('missing');

      expect(result).toBeNull();
    });
  });
});
