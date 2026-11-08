import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SETTABLE_STATUSES = ['APPROVED', 'REJECTED'] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

export class UpdateDecisionDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  /** Only APPROVED/REJECTED are settable here — RECORDED/PENDING_APPROVAL are system-assigned at creation. */
  @ApiPropertyOptional({ enum: SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(SETTABLE_STATUSES)
  status?: SettableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  approvalNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  alternatives?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  rationale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  impact?: string;
}
