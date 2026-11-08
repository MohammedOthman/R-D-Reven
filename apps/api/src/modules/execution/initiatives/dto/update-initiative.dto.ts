import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type {
  InitiativeCompletionDisposition,
  InitiativeHealth,
  InitiativeStage,
  InitiativeVisibility,
  RemainingActionsTreatment,
} from '@revn/db';

const STAGES: InitiativeStage[] = [
  'DRAFT',
  'PROPOSED',
  'APPROVED',
  'ACTIVE',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
];
const VISIBILITY_VALUES: InitiativeVisibility[] = ['PRIVATE', 'SHAREABLE'];
const HEALTH_VALUES: InitiativeHealth[] = ['HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL'];
const DISPOSITION_VALUES: InitiativeCompletionDisposition[] = [
  'ACHIEVED',
  'PARTIALLY_ACHIEVED',
  'NOT_ACHIEVED',
];
const TREATMENT_VALUES: RemainingActionsTreatment[] = ['CANCEL_REMAINING', 'LEAVE_OPEN'];

export class UpdateInitiativeDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: STAGES })
  @IsOptional()
  @IsIn(STAGES)
  stage?: InitiativeStage;

  /** Optional on any stage-changing PATCH, logged into initiative_status_changed — never enforced, no PRD text requires it. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lastTransitionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  successMeasure?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: VISIBILITY_VALUES })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: InitiativeVisibility;

  @ApiPropertyOptional({ enum: HEALTH_VALUES })
  @IsOptional()
  @IsIn(HEALTH_VALUES)
  health?: InitiativeHealth;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  /** Required (with `remainingActionsTreatment`) to move `stage` to COMPLETED. */
  @ApiPropertyOptional({ enum: DISPOSITION_VALUES })
  @IsOptional()
  @IsIn(DISPOSITION_VALUES)
  completionDisposition?: InitiativeCompletionDisposition;

  @ApiPropertyOptional({ enum: TREATMENT_VALUES })
  @IsOptional()
  @IsIn(TREATMENT_VALUES)
  remainingActionsTreatment?: RemainingActionsTreatment;

  /** T-007: required to complete an initiative that still has a BLOCKED action. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionOverrideReason?: string;
}
