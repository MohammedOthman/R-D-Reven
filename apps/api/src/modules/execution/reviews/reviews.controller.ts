import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { RoleGuard } from '../../identity-tenant/tenants/guards/role.guard';
import { RequireRole } from '../../identity-tenant/tenants/decorators/require-role.decorator';
import { CurrentUser } from '../../identity-tenant/auth/decorators/current-user.decorator';
import type { JwtPayload } from '../../identity-tenant/auth/jwt-payload.type';

// No PRD matrix row is named "Reviews" — borrows "Initiatives/actions"
// (Admin=Yes, Executive=Read, Manager=Yes, Reviewer=No, Guest=Shared items)
// since a Review is part of the same execution-workflow capability area
// (S08 sits alongside S07 in the screen inventory), not "Portfolio read" or
// "Decisions." See docs/DECISIONS.md.
const READ_ROLES = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER'] as const;
const WRITE_ROLES = ['OWNER', 'ADMIN', 'MANAGER'] as const;

@ApiTags('reviews')
@Controller('tenants/:tenantId/reviews')
@UseGuards(RoleGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @RequireRole(...READ_ROLES)
  @ApiOperation({ summary: 'List reviews — optionally scoped to one partnership.' })
  async list(@Param('tenantId') tenantId: string, @Query('partnershipId') partnershipId?: string) {
    const reviews = await this.reviewsService.list(tenantId, partnershipId);
    return { reviews };
  }

  @Get(':reviewId')
  @RequireRole(...READ_ROLES)
  @ApiOperation({
    summary: 'Get a review with its decisions and follow-up actions (S08 workspace).',
  })
  async get(@Param('tenantId') tenantId: string, @Param('reviewId') reviewId: string) {
    const review = await this.reviewsService.get(tenantId, reviewId);
    return { review };
  }

  @Post()
  @RequireRole(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Schedule a recurring review under a partnership (REV-01).' })
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const review = await this.reviewsService.create(tenantId, dto, claims.sub);
    return { review };
  }

  @Patch(':reviewId')
  @RequireRole(...WRITE_ROLES)
  @ApiOperation({
    summary:
      'Update a review or move it through a controlled stage transition (REV-02/04/05) — requires the last-read version.',
  })
  async update(
    @Param('tenantId') tenantId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() claims: JwtPayload,
  ) {
    const review = await this.reviewsService.update(tenantId, reviewId, dto, claims.sub);
    return { review };
  }
}
