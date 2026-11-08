import { IsIn, IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SETTABLE_STATUSES = [
  'IN_REVIEW',
  'CAPTURED',
  'SUSPENDED',
  'EFFECTIVE',
  'EXPIRED',
  'TERMINATED',
] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

export class UpdateAgreementDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(SETTABLE_STATUSES)
  status?: SettableStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  transitionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceRef?: string;
}
