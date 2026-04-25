import {
    Controller,
    Get,
    Param,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { LeaveBalancesService } from './leave-balances.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../auth/interfaces/current-user.interface';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaveBalancesController {
    constructor(private readonly leaveBalancesService: LeaveBalancesService) { }

    // Employee views their own balances across all locations
    @Get('employees/me/balances')
    async getMyBalances(@CurrentUser() currentUser: CurrentUserData) {
        return this.leaveBalancesService.getMyBalances(currentUser);
    }

    // Manager or Admin views all balances for a specific employee
    @Get('employees/:employeeId/balances')
    @Roles('manager', 'admin')
    async getBalancesByEmployee(
        @Param('employeeId', ParseUUIDPipe) employeeId: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.leaveBalancesService.getBalancesByEmployeeId(
            employeeId,
            currentUser,
        );
    }

    // Manager or Admin views balances for employee at specific location
    @Get('employees/:employeeId/balances/:locationId')
    @Roles('manager', 'admin')
    async getBalancesByEmployeeAndLocation(
        @Param('employeeId', ParseUUIDPipe) employeeId: string,
        @Param('locationId', ParseUUIDPipe) locationId: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        return this.leaveBalancesService.getBalanceByEmployeeAndLocation(
            employeeId,
            locationId,
            currentUser,
        );
    }
}