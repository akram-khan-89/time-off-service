import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { TimeOffRequestsService } from './time-off-requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/interfaces/current-user.interface';
import { CreateTimeOffRequestDto } from './dto/create-request.dto';
import { RejectRequestDto } from './dto/reject-request.dto';
import { CancelRequestDto } from './dto/cancel-request.dto';
import { ListRequestsDto } from './dto/list-requests.dto';

@Controller('time-off-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeOffRequestsController {
    constructor(
        private readonly timeOffRequestsService: TimeOffRequestsService,
    ) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async submit(
        @Body() dto: CreateTimeOffRequestDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.submit(dto, currentUser);
    }

    @Get('mine')
    async findMine(
        @Query() query: ListRequestsDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.findMine(currentUser, query);
    }

    @Get('team')
    @Roles('manager', 'admin')
    async findTeam(
        @Query() query: ListRequestsDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.findTeam(currentUser, query);
    }

    @Get()
    @Roles('admin')
    async findAll(@Query() query: ListRequestsDto) {
        return this.timeOffRequestsService.findAll(query);
    }

    @Get(':id')
    async findById(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.findById(id, currentUser);
    }

    @Post(':id/approve')
    @Roles('manager', 'admin')
    @HttpCode(HttpStatus.OK)
    async approve(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.approve(id, currentUser);
    }

    @Post(':id/reject')
    @Roles('manager', 'admin')
    @HttpCode(HttpStatus.OK)
    async reject(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: RejectRequestDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.reject(id, dto, currentUser);
    }

    @Post(':id/withdraw')
    @HttpCode(HttpStatus.OK)
    async withdraw(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.withdraw(id, currentUser);
    }

    @Post(':id/cancel')
    @Roles('admin')
    @HttpCode(HttpStatus.OK)
    async cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CancelRequestDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.timeOffRequestsService.cancel(id, dto, currentUser);
    }
}