import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const authHeader: string = request.headers['authorization'] || '';

        if (!authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException({
                message: 'Service token required',
                code: 'UNAUTHORIZED',
            });
        }

        const token = authHeader.replace('Bearer ', '').trim();
        const expectedToken = this.configService.get<string>('hcm.serviceToken');

        if (token !== expectedToken) {
            throw new UnauthorizedException({
                message: 'Invalid service token',
                code: 'UNAUTHORIZED',
            });
        }

        return true;
    }
}