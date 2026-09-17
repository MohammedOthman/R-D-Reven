import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './common/config/env.validation';
import { HealthModule } from './health/health.module';
import { IdentityTenantModule } from './modules/identity-tenant/identity-tenant.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { ExecutionModule } from './modules/execution/execution.module';
import { EvidenceOutcomesModule } from './modules/evidence-outcomes/evidence-outcomes.module';
import { AuditOperationsModule } from './modules/audit-operations/audit-operations.module';
import { IntelligenceModule } from './modules/intelligence/intelligence.module';
import { CommercialGovernanceModule } from './modules/commercial-governance/commercial-governance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    HealthModule,
    IdentityTenantModule,
    PortfolioModule,
    ExecutionModule,
    EvidenceOutcomesModule,
    AuditOperationsModule,
    IntelligenceModule,
    CommercialGovernanceModule,
    // Remaining domain modules (Revenue Share, Sharing, Integrations) are
    // reserved under src/modules per docs/ARCHITECTURE.md and register
    // here as they're built.
  ],
})
export class AppModule {}
