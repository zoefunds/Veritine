import { Wallet, type HDNodeWallet } from 'ethers';
import { UnauthorizedException } from '@nestjs/common';
import { buildSignInMessage } from '@veritine/shared-config';
import { AuthService } from './auth.service';
import type { PrismaService } from '../../shared/prisma.service';
import type { UsersService } from '../users/users.service';
import type { User } from '@prisma/client';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    primaryWalletAddress: '0x0000000000000000000000000000000000dead',
    displayName: null,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

// Real secp256k1 signing throughout - no mocked cryptography. This is the
// same style of verification exercised manually end-to-end in Phase 5,
// now captured as a repeatable automated test.
describe('AuthService', () => {
  let prisma: {
    authNonce: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    session: { create: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let usersService: jest.Mocked<UsersService>;
  let service: AuthService;

  beforeEach(() => {
    prisma = {
      authNonce: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      session: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    };
    usersService = {
      findOrCreateByWalletAddress: jest.fn(),
      getById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    service = new AuthService(prisma as unknown as PrismaService, usersService);
  });

  describe('issueNonce', () => {
    it('persists a lowercase-normalized nonce record and returns it', async () => {
      const result = await service.issueNonce('0xABC0000000000000000000000000000000ABCD');

      expect(prisma.authNonce.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ address: '0xabc0000000000000000000000000000000abcd' }),
        }),
      );
      expect(result.nonce).toMatch(/^[0-9a-f]{32}$/);
      expect(result.expiresInSeconds).toBeGreaterThan(0);
    });

    it('issues a different nonce on every call', async () => {
      const first = await service.issueNonce('0xabc0000000000000000000000000000000abcd');
      const second = await service.issueNonce('0xabc0000000000000000000000000000000abcd');
      expect(first.nonce).not.toBe(second.nonce);
    });
  });

  describe('verifySignIn', () => {
    async function signRealMessage(wallet: HDNodeWallet, nonce: string, issuedAt: string) {
      const message = buildSignInMessage({ address: wallet.address, nonce, issuedAt });
      const signature = await wallet.signMessage(message);
      return { message, signature };
    }

    it('accepts a genuinely valid signature and issues a session', async () => {
      const wallet = Wallet.createRandom();
      const nonce = 'a'.repeat(32);
      const issuedAt = new Date().toISOString();
      const { signature } = await signRealMessage(wallet, nonce, issuedAt);

      prisma.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        address: wallet.address.toLowerCase(),
        nonce,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      const user = makeUser({ primaryWalletAddress: wallet.address.toLowerCase() });
      usersService.findOrCreateByWalletAddress.mockResolvedValue(user);

      const result = await service.verifySignIn({ address: wallet.address, signature, nonce, issuedAt });

      expect(result.user).toBe(user);
      expect(result.token).toMatch(/^[0-9a-f]{64}$/);
      expect(prisma.authNonce.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ consumedAt: expect.any(Date) }) }),
      );
      expect(prisma.session.create).toHaveBeenCalled();
    });

    it('rejects a signature from a different wallet than the claimed address (impersonation attempt)', async () => {
      const signer = Wallet.createRandom();
      const claimedAddress = Wallet.createRandom().address; // a different address
      const nonce = 'b'.repeat(32);
      const issuedAt = new Date().toISOString();
      // Sign using the CLAIMED address in the message, but with the wrong key.
      const message = buildSignInMessage({ address: claimedAddress, nonce, issuedAt });
      const signature = await signer.signMessage(message);

      prisma.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        address: claimedAddress.toLowerCase(),
        nonce,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifySignIn({ address: claimedAddress, signature, nonce, issuedAt }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.session.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown nonce', async () => {
      const wallet = Wallet.createRandom();
      prisma.authNonce.findUnique.mockResolvedValue(null);

      await expect(
        service.verifySignIn({ address: wallet.address, signature: '0xdeadbeef', nonce: 'missing', issuedAt: new Date().toISOString() }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a replayed (already-consumed) nonce', async () => {
      const wallet = Wallet.createRandom();
      const nonce = 'c'.repeat(32);
      const issuedAt = new Date().toISOString();
      const { signature } = await signRealMessage(wallet, nonce, issuedAt);

      prisma.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        address: wallet.address.toLowerCase(),
        nonce,
        consumedAt: new Date(), // already used
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifySignIn({ address: wallet.address, signature, nonce, issuedAt }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired nonce', async () => {
      const wallet = Wallet.createRandom();
      const nonce = 'd'.repeat(32);
      const issuedAt = new Date().toISOString();
      const { signature } = await signRealMessage(wallet, nonce, issuedAt);

      prisma.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        address: wallet.address.toLowerCase(),
        nonce,
        consumedAt: null,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      await expect(
        service.verifySignIn({ address: wallet.address, signature, nonce, issuedAt }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the nonce belongs to a different address', async () => {
      const wallet = Wallet.createRandom();
      const otherAddress = Wallet.createRandom().address;
      const nonce = 'e'.repeat(32);
      const issuedAt = new Date().toISOString();
      const { signature } = await signRealMessage(wallet, nonce, issuedAt);

      prisma.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        address: otherAddress.toLowerCase(), // nonce was issued for a different address
        nonce,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifySignIn({ address: wallet.address, signature, nonce, issuedAt }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a malformed signature without crashing', async () => {
      const wallet = Wallet.createRandom();
      const nonce = 'f'.repeat(32);
      const issuedAt = new Date().toISOString();

      prisma.authNonce.findUnique.mockResolvedValue({
        id: 'nonce-1',
        address: wallet.address.toLowerCase(),
        nonce,
        consumedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifySignIn({ address: wallet.address, signature: '0xnotasignature', nonce, issuedAt }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resolveSession', () => {
    it('returns null for a token with no matching session', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      const result = await service.resolveSession('some-token');
      expect(result).toBeNull();
    });

    it('returns null for a revoked session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        userId: 'user-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });
      const result = await service.resolveSession('some-token');
      expect(result).toBeNull();
    });

    it('returns null for an expired session', async () => {
      prisma.session.findUnique.mockResolvedValue({
        userId: 'user-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      const result = await service.resolveSession('some-token');
      expect(result).toBeNull();
    });

    it('returns the user for a valid, unexpired, unrevoked session', async () => {
      const user = makeUser();
      prisma.session.findUnique.mockResolvedValue({
        userId: user.id,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      usersService.getById.mockResolvedValue(user);

      const result = await service.resolveSession('some-token');
      expect(result).toBe(user);
    });
  });

  describe('revokeSession', () => {
    it('only revokes sessions that are not already revoked', async () => {
      await service.revokeSession('some-token');
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
