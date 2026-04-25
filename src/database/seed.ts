import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmployeesService } from '../modules/employees/employees.service';
import { LocationsService } from '../modules/locations/locations.service';
import { EmployeeRole } from './entities/employee.entity';

async function seed() {
    const app = await NestFactory.createApplicationContext(AppModule);

    const employeesService = app.get(EmployeesService);
    const locationsService = app.get(LocationsService);

    console.log('Seeding locations...');

    const locationNY = await locationsService.create({
        hcmLocationId: 'LOC-NY-001',
        name: 'New York Office',
        countryCode: 'US',
        isActive: true,
    });

    const locationLHR = await locationsService.create({
        hcmLocationId: 'LOC-LHR-001',
        name: 'London Office',
        countryCode: 'GB',
        isActive: true,
    });

    console.log('Seeding employees...');

    const admin = await employeesService.create({
        hcmEmployeeId: 'HCM-ADMIN-001',
        email: 'admin@company.com',
        fullName: 'Admin User',
        role: EmployeeRole.ADMIN,
        managerId: null,
        isActive: true,
    });

    const manager = await employeesService.create({
        hcmEmployeeId: 'HCM-MGR-001',
        email: 'manager@company.com',
        fullName: 'Samantha Manager',
        role: EmployeeRole.MANAGER,
        managerId: admin.id,
        isActive: true,
    });

    await employeesService.create({
        hcmEmployeeId: 'HCM-EMP-001',
        email: 'David@company.com',
        fullName: 'David Employee',
        role: EmployeeRole.EMPLOYEE,
        managerId: manager.id,
        isActive: true,
    });

    await employeesService.create({
        hcmEmployeeId: 'HCM-EMP-002',
        email: 'Jessica@company.com',
        fullName: 'Jessica Employee',
        role: EmployeeRole.EMPLOYEE,
        managerId: manager.id,
        isActive: true,
    });

    console.log('✅ Seed complete');
    console.log('');
    console.log('Login credentials (password: password123):');
    console.log('  admin@company.com    → role: admin');
    console.log('  manager@company.com  → role: manager');
    console.log('  David@company.com    → role: employee');
    console.log('  Jessica@company.com  → role: employee');
    console.log('');
    console.log('Locations created:');
    console.log(`  ${locationNY.id} → New York Office`);
    console.log(`  ${locationLHR.id} → London Office`);

    await app.close();
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});