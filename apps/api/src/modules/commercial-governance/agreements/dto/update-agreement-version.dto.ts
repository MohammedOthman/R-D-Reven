import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SETTABLE_STATUSES = ['APPROVED'] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

export class UpdateAgreementVersionDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  /** Only APPROVED is settable here — DRAFT is the only other state, and a draft version is simply edited or left alone, never "rejected" as its own transition. */
  @ApiPropertyOptional({ enum: SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(SETTABLE_STATUSES)
  approvalStatus?: SettableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  terms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
