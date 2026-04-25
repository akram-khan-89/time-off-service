import {
    IsOptional,
    IsInt,
    Min,
    Max,
    IsEnum,
    IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequestStatus } from '../../../database/entities/time-off-request.entity';

export class ListRequestsDto {
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

    @IsOptional()
    @IsEnum(RequestStatus)
    status?: RequestStatus;

    @IsOptional()
    @IsUUID()
    employeeId?: string;
}