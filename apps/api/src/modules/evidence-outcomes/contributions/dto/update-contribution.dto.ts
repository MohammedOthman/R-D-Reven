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
import { EVIDENCE_CLASSIFICATIONS, type EvidenceClassificationValue } from '../../classification';

export class UpdateContributionDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  observedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  narrative?: string;

  @ApiPropertyOptional({ enum: EVIDENCE_CLASSIFICATIONS })
  @IsOptional()
  @IsIn(EVIDENCE_CLASSIFICATIONS)
  classification?: EvidenceClassificationValue;
}
