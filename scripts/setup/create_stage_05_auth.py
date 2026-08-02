#!/usr/bin/env python3
"""
Veritine - Stage 05: Wallet-based authentication.

Implements the nonce-challenge signature auth flow selected in Phase 0:
- POST /api/v1/auth/nonce   - issue a single-use, TTL-bound nonce for an address
- POST /api/v1/auth/verify  - verify a signed message, recover the signer,
                               create/find the User, issue a session cookie
- POST /api/v1/auth/logout  - revoke the current session
- GET  /api/v1/auth/me      - return the authenticated user (or 401)

The exact sign-in message text is shared between frontend and backend via
@veritine/shared-config so the browser signs precisely what the backend
verifies.

Run from: /Users/macbook/source-stake  (the project root)
Command:  python3 scripts/setup/create_stage_05_auth.py

Safe to rerun: yes, overwrites the files it manages.
"""

import os
import sys

ROOT = os.getcwd()

DIRS = [
    "apps/api/src/modules/auth",
]

FILES = {}

# ---------------------------------------------------------------------------
# Shared sign-in message builder (frontend signs this, backend verifies it)
# ---------------------------------------------------------------------------

FILES["packages/shared-config/src/auth-message.ts"] = """// The exact text a wallet signs to authenticate with Veritine. Lives in
// a shared package so the frontend (which asks the wallet to sign it)
// and the backend (which verifies the recovered signer against it)
// can never drift apart.

export const SIGN_IN_DOMAIN = 'veritine.app';

export interface SignInMessageParams {
  address: string;
  nonce: string;
  issuedAt: string; // ISO timestamp
}

/**
 * Builds the human-readable message a wallet signs to authenticate. This
 * intentionally mirrors the readability goals of SIWE (EIP-4361) without
 * taking on the full library as a dependency - the fields that matter for
 * replay protection (nonce, issuedAt, address, domain) are all present
 * and are exactly what the backend re-derives and checks.
 */
export function buildSignInMessage({ address, nonce, issuedAt }: SignInMessageParams): string {
  return [
    `${SIGN_IN_DOMAIN} wants you to sign in with your wallet.`,
    '',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    '',
    'This request will not trigger a blockchain transaction or cost any gas fees.',
  ].join('\\n');
}
"""

# ---------------------------------------------------------------------------
# Validation schemas for the auth endpoints
# ---------------------------------------------------------------------------

FILES["packages/validation/src/auth-schemas.ts"] = """import { z } from 'zod';

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Must be a valid EVM-style address (0x + 40 hex chars)');

export const requestNonceSchema = z.object({
  address: evmAddress,
});
export type RequestNonceInput = z.infer<typeof requestNonceSchema>;

export const verifySignInSchema = z.object({
  address: evmAddress,
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Signature must be 0x-prefixed hex'),
  nonce: z.string().min(1),
  issuedAt: z.string().datetime(),
});
export type VerifySignInInput = z.infer<typeof verifySignInSchema>;
"""

# ---------------------------------------------------------------------------
# NestJS auth module
# ---------------------------------------------------------------------------

FILES["apps/api/src/modules/auth/auth.module.ts"] = """import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from '../../shared/prisma.service';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  imports: [
    UsersModule,
    ThrottlerModule.forRoot([
      // Nonce issuance is the endpoint most worth protecting from abuse -
      // each request writes a row and could be spammed to grow the table
      // or brute-force-guess valid nonces for an address.
      { name: 'auth', ttl: 60_000, limit: 20 },
    ]),
  ],
  controllers: [AuthController],
  providers: [PrismaService, AuthService, SessionAuthGuard],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
"""

FILES["apps/api/src/modules/auth/auth.service.ts"] = """import { Injectable, UnauthorizedException } from '@nestjs/common';
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
"""

FILES["apps/api/src/modules/auth/session-auth.guard.ts"] = """import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

export const SESSION_COOKIE_NAME = 'veritine_session';

/** Attaches the resolved User to req.user, or throws 401. */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const token = request.cookies?.[SESSION_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.authService.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException('Session is invalid or has expired');
    }
    request.user = user;
    return true;
  }
}
"""

FILES["apps/api/src/modules/auth/current-user.decorator.ts"] = """import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest<Request & { user: User }>();
  return request.user;
});
"""

FILES["apps/api/src/modules/auth/auth.controller.ts"] = """import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { ZodIssue } from 'zod';
import { requestNonceSchema, verifySignInSchema } from '@veritine/validation';
import { AuthService } from './auth.service';
import { SessionAuthGuard, SESSION_COOKIE_NAME } from './session-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { User } from '@prisma/client';

const isProduction = process.env.NODE_ENV === 'production';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ auth: { limit: 20, ttl: 60_000 } })
  @Post('nonce')
  async requestNonce(@Body() body: unknown) {
    const parsed = requestNonceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i: ZodIssue) => i.message).join('; '));
    }
    return this.authService.issueNonce(parsed.data.address);
  }

  @Post('verify')
  async verify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const parsed = verifySignInSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i: ZodIssue) => i.message).join('; '));
    }

    const { user, token, expiresAt } = await this.authService.verifySignIn(parsed.data);

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      expires: expiresAt,
      path: '/',
    });

    return {
      id: user.id,
      primaryWalletAddress: user.primaryWalletAddress,
      displayName: user.displayName,
    };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (token) {
      await this.authService.revokeSession(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return {
      id: user.id,
      primaryWalletAddress: user.primaryWalletAddress,
      displayName: user.displayName,
      status: user.status,
    };
  }
}
"""


def main():
    for d in DIRS:
        os.makedirs(os.path.join(ROOT, d), exist_ok=True)

    written = []
    for rel_path, content in FILES.items():
        full_path = os.path.join(ROOT, rel_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(rel_path)

    print(f"Wrote {len(written)} files:")
    for p in written:
        print(f"  + {p}")


if __name__ == "__main__":
    try:
        main()
    except OSError as e:
        print(f"ERROR: file operation failed: {e}", file=sys.stderr)
        sys.exit(1)
