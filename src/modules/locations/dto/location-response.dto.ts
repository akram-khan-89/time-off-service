export class LocationResponseDto {
    id!: string;
    hcmLocationId!: string;
    name!: string;
    countryCode!: string;
    isActive!: boolean;

    static from(location: any): LocationResponseDto {
        const dto = new LocationResponseDto();
        dto.id = location.id;
        dto.hcmLocationId = location.hcmLocationId;
        dto.name = location.name;
        dto.countryCode = location.countryCode;
        dto.isActive = location.isActive;
        return dto;
    }
}