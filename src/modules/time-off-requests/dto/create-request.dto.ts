import {
    IsUUID,
    IsString,
    IsDateString,
    IsNotEmpty,
} from 'class-validator';

export class CreateTimeOffRequestDto {
    @IsUUID()
    locationId!: string;

    @IsString()
    @IsNotEmpty()
    leaveType!: string;

    @IsDateString()
    startDate!: string;

    @IsDateString()
    endDate!: string;
}