import { Module } from '@nestjs/common';
import { InitiativesController } from './initiatives/initiatives.controller';
import { InitiativesService } from './initiatives/initiatives.service';
import { MilestonesController } from './milestones/milestones.controller';
import { MilestonesService } from './milestones/milestones.service';
import { ActionsController } from './actions/actions.controller';
import { ActionsFlatController } from './actions/actions-flat.controller';
import { ActionsService } from './actions/actions.service';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { ReviewActionsController } from './reviews/review-actions.controller';
import { ReviewDecisionsController } from './reviews/review-decisions.controller';
import { DecisionsController } from './decisions/decisions.controller';
import { DecisionsService } from './decisions/decisions.service';
import { IdentityTenantModule } from '../identity-tenant/identity-tenant.module';

@Module({
  imports: [IdentityTenantModule],
  controllers: [
    InitiativesController,
    MilestonesController,
    ActionsController,
    ActionsFlatController,
    ReviewsController,
    ReviewActionsController,
    ReviewDecisionsController,
    DecisionsController,
  ],
  providers: [
    InitiativesService,
    MilestonesService,
    ActionsService,
    ReviewsService,
    DecisionsService,
  ],
})
export class ExecutionModule {}
