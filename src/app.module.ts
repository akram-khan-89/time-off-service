import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';

@Module({
  imports: [
    // Config — global so every module can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('database.path'),
        entities: [__dirname + '/database/entities/*.entity{.ts,.js}'],
        synchronize: true, // Only for dev/test — in prod use migrations
        logging: config.get<string>('nodeEnv') === 'development',
      }),
    }),
  ],
})
export class AppModule {}