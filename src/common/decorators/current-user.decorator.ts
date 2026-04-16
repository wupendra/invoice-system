import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser { id: number; email: string; role: 'admin' | 'viewer' }

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest().user,
);
