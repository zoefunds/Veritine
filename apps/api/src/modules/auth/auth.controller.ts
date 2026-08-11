import {
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

/**
 * Frontend (Vercel) and backend (Fly.io) are on different domains, which
 * makes every browser fetch from the frontend to this API a cross-site
 * request. `SameSite=Strict` (or the express cookie-serialize default,
 * Lax) tells the browser to never attach the cookie to a cross-site
 * fetch/XHR - only `SameSite=None` does. The cookie was still being SET
 * fine (that's a CORS concern, already handled by
 * `app.enableCors({ credentials: true })` in main.ts) but the browser
 * silently dropped it on every subsequent request, so nothing after
 * /auth/verify's own response body ever saw the user as signed in -
 * hence "signed in" reverting to "Sign in" on every reload. `SameSite=None`
 * requires `Secure`, so this only applies in production; local dev runs
 * both apps on localhost, which is same-site, so Strict is fine there.
 */
const sessionCookieOptions = isProduction
  ? ({ httpOnly: true, secure: true, sameSite: 'none' as const, path: '/' })
  : ({ httpOnly: true, secure: false, sameSite: 'strict' as const, path: '/' });

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
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

    res.cookie(SESSION_COOKIE_NAME, token, { ...sessionCookieOptions, expires: expiresAt });

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
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
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
