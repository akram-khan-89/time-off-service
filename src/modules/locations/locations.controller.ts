import {
    Controller,
    Get,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { LocationsService } from './locations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Get()
    async findAll() {
        return this.locationsService.findAll();
    }

    @Get(':id')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        return this.locationsService.findById(id);
    }
}