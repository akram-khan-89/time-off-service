import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    ParseUUIDPipe,
    NotFoundException,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ServiceTokenGuard } from '../auth/guards/service-token.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { BatchIngestDto } from './dto/batch-ingest.dto';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class SyncLogQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 20;
}

@Controller('sync')
export class SyncController {
    constructor(private readonly syncService: SyncService) { }

    @Post('batch-ingest')
    @UseGuards(ServiceTokenGuard)
    @HttpCode(HttpStatus.ACCEPTED)
    async batchIngest(@Body() dto: BatchIngestDto) {
        return this.syncService.enqueueBatchIngest(dto, null);
    }

    @Post('trigger')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    @HttpCode(HttpStatus.ACCEPTED)
    async trigger(@CurrentUser() currentUser: CurrentUserData) {
        return this.syncService.triggerManualSync(currentUser);
    }

    @Get('logs')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getLogs(@Query() query: SyncLogQueryDto) {
        return this.syncService.findAllLogs(query.page, query.limit);
    }

    @Get('logs/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('admin')
    async getLogById(@Param('id', ParseUUIDPipe) id: string) {
        const log = await this.syncService.findLogById(id);
        if (!log) {
            throw new NotFoundException({
                message: 'Sync log not found',
                code: 'SYNC_LOG_NOT_FOUND',
            });
        }
        return log;
    }
}