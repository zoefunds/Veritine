import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Protects operational endpoints (like the manual indexer sync trigger)
 * that are meant to be called by ops tooling, not the general public.
 *
 * Why this matters here specifically: GenLayer StudioNet's public RPC has
 * a hard cap of 5,000 requests/day (confirmed by hitting it during Phase 9
 * testing), shared across every consumer. An unauthenticated sync trigger
 * that fans out into 2 RPC calls per indexed dispute would let anyone
 * exhaust that quota for the whole platform with a handful of requests.
 *
 * If INTERNAL_API_KEY is not configured (e.g. local development), this
 * guard falls back to allowing the request through - the endpoint is
 * still protected by the global rate limiter in that case, which is an
 * acceptable trade-off for a local, non-production environment.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedKey = process.env.INTERNAL_API_KEY;
    if (!expectedKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = request.header('x-internal-api-key');

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Missing or invalid internal API key');
    }
    return true;
  }
}
