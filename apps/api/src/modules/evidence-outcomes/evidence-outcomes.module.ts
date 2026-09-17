import { Module } from '@nestjs/common';
import { ContributionsController } from './contributions/contributions.controller';
import { ContributionsService } from './contributions/contributions.service';
import { EvidenceController } from './evidence/evidence.controller';
import { EvidenceService } from './evidence/evidence.service';
import { OutcomesController } from './outcomes/outcomes.controller';
import { OutcomesService } from './outcomes/outcomes.service';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [ContributionsController, EvidenceController, OutcomesController],
  providers: [ContributionsService, EvidenceService, OutcomesService],
})
export class EvidenceOutcomesModule {}
