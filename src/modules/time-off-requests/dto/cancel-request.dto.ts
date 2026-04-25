import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CancelRequestDto {
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}