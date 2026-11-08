import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { UsersService } from './users/users.service';
import { MailerService } from './mail/mailer.service';
import { TenantsController } from './tenants/tenants.controller';
import { TenantsService } from './tenants/tenants.service';
import { RoleGuard } from './tenants/guards/role.guard';
import { MembersController } from './members/members.controller';
import { MembersService } from './members/members.service';
import { InvitationsController } from './invitations/invitations.controller';
import { InvitationsService } from './invitations/invitations.service';
import type { Env } from '../../common/config/env.validation';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth/auth.constants';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { expiresIn: ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController, TenantsController, MembersController, InvitationsController],
  providers: [
    AuthService,
    UsersService,
    MailerService,
    TenantsService,
    RoleGuard,
    MembersService,
    InvitationsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  // `RoleGuard` is exported so any other domain module can put
  // `@UseGuards(RoleGuard)` on its own controllers — it's the shared
  // capability-check mechanism, not something identity-tenant keeps to itself.
  exports: [UsersService, TenantsService, RoleGuard],
})
export class IdentityTenantModule {}
