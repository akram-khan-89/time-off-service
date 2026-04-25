import {
    IsString,
    IsNumber,
    IsArray,
    ValidateNested,
    IsDateString,
    Min,
    IsNotEmpty,
} from 'class-validator';
import { Type, plainToInstance } from 'class-transformer';

export class HcmBalanceItemDto {
    @IsString()
    @IsNotEmpty()
    leaveType!: string;

    @IsNumber()
    @Min(0)
    balanceDays!: number;

    @IsDateString()
    asOf!: string;
}

export class HcmBalanceResponseDto {
    @IsString()
    @IsNotEmpty()
    hcmEmployeeId!: string;

    @IsString()
    @IsNotEmpty()
    hcmLocationId!: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => HcmBalanceItemDto)
    balances!: HcmBalanceItemDto[];

    static from(raw: unknown): HcmBalanceResponseDto {
        return plainToInstance(HcmBalanceResponseDto, raw);
    }
}

export class HcmSubmissionResponseDto {
    @IsString()
    @IsNotEmpty()
    reference!: string;

    @IsString()
    status!: 'accepted' | 'rejected';

    @IsString()
    reason?: string;

    @IsNumber()
    @Min(0)
    remainingBalance?: number;

    static from(raw: unknown): HcmSubmissionResponseDto {
        return plainToInstance(HcmSubmissionResponseDto, raw);
    }
}