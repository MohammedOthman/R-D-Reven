import { IsDateString, IsIn, IsInt, IsObject, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SETTABLE_STATUSES = ['APPROVED'] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

export class UpdateCommercialRuleVersionDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(SETTABLE_STATUSES)
  approvalStatus?: SettableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  definition?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  precedence?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
