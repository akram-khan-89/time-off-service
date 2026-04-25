import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CurrentUserData } from '../../modules/auth/interfaces/current-user.interface';

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): CurrentUserData => {
        const request = ctx.switchToHttp().getRequest();
        return request.user;
    },
);