import {
    IsArray,
    IsString,
    IsNumber,
    IsDateString,
    IsNotEmpty,
    Min,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BatchBalanceRecordDto {
    @IsString()
    @IsNotEmpty()
    hcmEmployeeId!: string;

    @IsString()
    @IsNotEmpty()
    hcmLocationId!: string;

    @IsString()
    @IsNotEmpty()
    leaveType!: string;

    @IsNumber()
    @Min(0)
    balanceDays!: number;

    @IsDateString()
    asOf!: string;
}

export class BatchIngestDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => BatchBalanceRecordDto)
    records!: BatchBalanceRecordDto[];
}