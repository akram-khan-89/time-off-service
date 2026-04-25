import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from '../../database/entities/location.entity';
import { LocationResponseDto } from './dto/location-response.dto';

@Injectable()
export class LocationsService {
    constructor(
        @InjectRepository(Location)
        private readonly locationRepo: Repository<Location>,
    ) { }

    async findAll(): Promise<LocationResponseDto[]> {
        const locations = await this.locationRepo.find({
            where: { isActive: true },
            order: { name: 'ASC' },
        });
        return locations.map(LocationResponseDto.from);
    }

    async findById(id: string): Promise<LocationResponseDto> {
        const location = await this.locationRepo.findOne({
            where: { id, isActive: true },
        });

        if (!location) {
            throw new NotFoundException({
                message: 'Location not found',
                code: 'LOCATION_NOT_FOUND',
            });
        }

        return LocationResponseDto.from(location);
    }

    // Used internally — resolves hcmLocationId → internal location
    async findByHcmId(hcmLocationId: string): Promise<Location | null> {
        return this.locationRepo.findOne({
            where: { hcmLocationId, isActive: true },
        });
    }

    // Used internally by other modules
    async findByIdRaw(id: string): Promise<Location> {
        const location = await this.locationRepo.findOne({
            where: { id, isActive: true },
        });

        if (!location) {
            throw new NotFoundException({
                message: 'Location not found',
                code: 'LOCATION_NOT_FOUND',
            });
        }

        return location;
    }

    // Used in seeding and tests
    async create(data: Partial<Location>): Promise<Location> {
        const location = this.locationRepo.create(data);
        return this.locationRepo.save(location);
    }
}