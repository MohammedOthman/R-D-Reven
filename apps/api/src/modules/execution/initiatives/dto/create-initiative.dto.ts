import {
  IsDateString,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import type { InitiativeVisibility } from '@revn/db';

const VISIBILITY_VALUES: InitiativeVisibility[] = ['PRIVATE', 'SHAREABLE'];

export class CreateInitiativeDto {
  @ApiProperty()
  @IsUUID()
  partnershipId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  objective!: string;

  /** {type, target, unit, date} — unshaped, see docs/DECISIONS.md. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  successMeasure?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: VISIBILITY_VALUES })
  @IsOptional()
  @IsIn(VISIBILITY_VALUES)
  visibility?: InitiativeVisibility;

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
}
