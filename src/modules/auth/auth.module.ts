import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Employee } from '../../database/entities/employee.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ServiceTokenGuard } from './guards/service-token.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([Employee]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const secret = config.get<string>('jwt.secret');
                const expiresIn = config.get<string>('jwt.expiresIn');
                if (!secret) {
                    throw new Error('JWT_SECRET is missing in environment');
                }

                if (!expiresIn) {
                    throw new Error('JWT_EXPIRES_IN is missing in environment');
                }
                return {
                    secret,
                    signOptions: {
                        expiresIn: expiresIn as any,
                    },
                };
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, ServiceTokenGuard],
    exports: [
        AuthService,
        JwtAuthGuard,
        RolesGuard,
        ServiceTokenGuard,
        JwtModule,
    ],
})
export class AuthModule { }