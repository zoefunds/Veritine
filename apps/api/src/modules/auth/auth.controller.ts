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
