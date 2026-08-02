import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { verifyMessage } from 'ethers';
import { User } from '@prisma/client';
import { buildSignInMessage } from '@veritine/shared-config';
import { PrismaService } from '../../shared/prisma.service';
import { UsersService } from '../users/users.service';

const NONCE_BYTES = 16;
const SESSION_TOKEN_BYTES = 32;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface IssuedSession {
  user: User;
  token: string;
  expiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly nonceTtlSeconds = Number(process.env.NONCE_TTL_SECONDS ?? 300);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  /** Issues a fresh, single-use nonce for the given address. */
  async issueNonce(address: string): Promise<{ nonce: string; issuedAt: string; expiresInSeconds: number }> {
    const normalized = address.toLowerCase();
    const nonce = randomBytes(NONCE_BYTES).toString('hex');
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + this.nonceTtlSeconds * 1000);

    await this.prisma.authNonce.create({
      data: { address: normalized, nonce, expiresAt },
    });

    return { nonce, issuedAt: issuedAt.toISOString(), expiresInSeconds: this.nonceTtlSeconds };
  }

  /**
   * Verifies a signed sign-in message and, on success, issues a session.
   * Every failure path throws UnauthorizedException with a generic
   * message - never leak which specific check failed, to avoid helping
   * an attacker enumerate valid nonces or addresses.
   */
  async verifySignIn(params: {
    address: string;
    signature: string;
    nonce: string;
    issuedAt: string;
  }): Promise<IssuedSession> {
    const normalized = params.address.toLowerCase();

    const storedNonce = await this.prisma.authNonce.findUnique({ where: { nonce: params.nonce } });
    if (
      !storedNonce ||
      storedNonce.address !== normalized ||
      storedNonce.consumedAt !== null ||
      storedNonce.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException('Sign-in request is invalid or has expired');
    }

    const message = buildSignInMessage({
      address: params.address,
      nonce: params.nonce,
      issuedAt: params.issuedAt,
    });

    let recovered: string;
    try {
      recovered = verifyMessage(message, params.signature);
    } catch {
      throw new UnauthorizedException('Sign-in request is invalid or has expired');
    }

    if (recovered.toLowerCase() !== normalized) {
      throw new UnauthorizedException('Sign-in request is invalid or has expired');
    }

    // Consume the nonce immediately so it can never be replayed, even if
    // the rest of this method somehow ran twice concurrently for the
    // same nonce (the unique constraint + this update make a second
    // consumption attempt fail the check above on retry).
    await this.prisma.authNonce.update({
      where: { id: storedNonce.id },
      data: { consumedAt: new Date() },
    });

    const user = await this.usersService.findOrCreateByWalletAddress(normalized, 'genlayer-studionet');

    const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.prisma.session.create({
      data: { userId: user.id, tokenHash, address: normalized, expiresAt },
    });

    return { user, token, expiresAt };
  }

  async resolveSession(token: string): Promise<User | null> {
    const tokenHash = this.hashToken(token);
    const session = await this.prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return this.usersService.getById(session.userId);
  }

  async revokeSession(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
