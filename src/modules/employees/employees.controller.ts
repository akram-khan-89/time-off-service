import {
    Controller,
    Get,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { ListEmployeesDto } from './dto/list-employees.dto';

@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeesController {
    constructor(private readonly employeesService: EmployeesService) { }

    @Get('me')
    async getMe(@CurrentUser() currentUser: CurrentUserData) {
        return this.employeesService.findMe(currentUser);
    }

    @Get()
    @Roles('admin')
    async listAll(@Query() query: ListEmployeesDto) {
        return this.employeesService.findAll(query);
    }

    @Get(':id')
    @Roles('manager', 'admin')
    async getById(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.employeesService.findById(id, currentUser);
    }
}