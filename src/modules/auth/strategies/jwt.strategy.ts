import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { CurrentUserData } from '../interfaces/current-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey:
                configService.get<string>('jwt.secret') ||
                (() => {
                    throw new Error('JWT_SECRET is not defined');
                })(),
        });
    }

    async validate(payload: JwtPayload): Promise<CurrentUserData> {
        if (!payload.sub || !payload.role) {
            throw new UnauthorizedException();
        }

        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            hcmEmployeeId: payload.hcmEmployeeId,
        };
    }
}