import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PartnershipHealth, PartnershipStage } from '@revn/db';

const STAGES: PartnershipStage[] = [
  'PROSPECT',
  'QUALIFIED',
  'PLANNING',
  'ACTIVE',
  'AT_RISK',
  'PAUSED',
  'TERMINATED',
  'ARCHIVED',
];

const HEALTH_VALUES: PartnershipHealth[] = ['HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL'];

export class UpdatePartnershipDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. A mismatch is a 409, not a silent overwrite. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: STAGES })
  @IsOptional()
  @IsIn(STAGES)
  stage?: PartnershipStage;

  /** PORT-04: transition reasons are enforced by the service for the At Risk, Paused and Terminated transitions — not validated here since that depends on the target stage. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  transitionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sponsorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  motion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cadence?: string;

  @ApiPropertyOptional({ enum: HEALTH_VALUES })
  @IsOptional()
  @IsIn(HEALTH_VALUES)
  health?: PartnershipHealth;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextReviewAt?: string;
}
