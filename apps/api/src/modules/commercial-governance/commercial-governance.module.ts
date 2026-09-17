import { Module } from '@nestjs/common';
import { AgreementsController } from './agreements/agreements.controller';
import { AgreementVersionsController } from './agreements/agreement-versions.controller';
import { AgreementsService } from './agreements/agreements.service';
import { CommercialRulesController } from './commercial-rules/commercial-rules.controller';
import { CommercialRuleVersionsController } from './commercial-rules/commercial-rule-versions.controller';
import { CommercialRulesService } from './commercial-rules/commercial-rules.service';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [
    AgreementsController,
    AgreementVersionsController,
    CommercialRulesController,
    CommercialRuleVersionsController,
  ],
  providers: [AgreementsService, CommercialRulesService],
})
export class CommercialGovernanceModule {}
