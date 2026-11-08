import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class IntelligenceModule {}
