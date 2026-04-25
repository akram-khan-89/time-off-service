import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

class AuditQueryDto {
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

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    async findAll(@Query() query: AuditQueryDto) {
        return this.auditService.findAll(query.page, query.limit);
    }

    @Get(':entityType/:entityId')
    async findByEntity(
        @Param('entityType') entityType: string,
        @Param('entityId', ParseUUIDPipe) entityId: string,
    ) {
        return this.auditService.findByEntity(entityType, entityId);
    }

    @Get('actor/:actorId')
    async findByActor(
        @Param('actorId', ParseUUIDPipe) actorId: string,
    ) {
        return this.auditService.findByActor(actorId);
    }
}