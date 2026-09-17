import { Module } from '@nestjs/common';
import { AuditEventsController } from './audit-events.controller';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [AuditEventsController],
})
export class AuditOperationsModule {}
