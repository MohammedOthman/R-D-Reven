import {
  IsIn,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const SETTABLE_STATUSES = ['SUBMITTED', 'VERIFIED', 'REJECTED', 'VERIFICATION_REQUIRED'] as const;
type SettableStatus = (typeof SETTABLE_STATUSES)[number];

export class UpdateOutcomeDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: SETTABLE_STATUSES })
  @IsOptional()
  @IsIn(SETTABLE_STATUSES)
  status?: SettableStatus;

  /** Required when moving to SUBMITTED — the authorized verifier this outcome is assigned to (OUT-02). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  verifierId?: string;

  /** The verifier's reasoning — required for VERIFIED and VERIFICATION_REQUIRED. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  verifierDisposition?: string;

  /** Required when moving to REJECTED. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  claimedResult?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumberString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  period?: string;
}
