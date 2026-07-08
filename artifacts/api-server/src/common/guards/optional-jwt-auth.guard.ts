import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../interfaces';

/**
 * Optional JWT guard: always allows the request through, but populates
 * `request.user` when a valid bearer token is present. Use for endpoints
 * that behave differently for authenticated vs anonymous callers
 * (e.g. premium content gating).
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context) as any;
  }

  handleRequest<TUser = AuthenticatedUser>(_err: unknown, user: unknown): TUser {
    // Never throw — return the user if present, otherwise null.
    return (user as TUser) ?? (null as unknown as TUser);
  }
}
