import { Module } from '@nestjs/common';
import { PartnersController } from './partners/partners.controller';
import { PartnersService } from './partners/partners.service';
import { PartnershipsController } from './partnerships/partnerships.controller';
import { PartnershipsListController } from './partnerships/partnerships-list.controller';
import { PartnershipsService } from './partnerships/partnerships.service';
import { ImportsController } from './imports/imports.controller';
import { ImportsService } from './imports/imports.service';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [
    PartnersController,
    PartnershipsController,
    PartnershipsListController,
    ImportsController,
  ],
  providers: [PartnersService, PartnershipsService, ImportsService],
})
export class PortfolioModule {}
