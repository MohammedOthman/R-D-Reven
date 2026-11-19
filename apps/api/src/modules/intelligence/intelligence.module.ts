import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { EcosystemGraphController } from './ecosystem-graph/ecosystem-graph.controller';
import { EcosystemGraphService } from './ecosystem-graph/ecosystem-graph.service';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [DashboardController, EcosystemGraphController],
  providers: [DashboardService, EcosystemGraphService],
})
export class IntelligenceModule {}
