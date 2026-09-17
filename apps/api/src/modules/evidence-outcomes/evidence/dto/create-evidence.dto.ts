import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EVIDENCE_CLASSIFICATIONS, type EvidenceClassificationValue } from '../../classification';

export class CreateEvidenceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contributionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  /** Free text or URL — EVD-02's "upload or reference." A file can be attached afterward. */
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  source!: string;

  @ApiProperty()
  @IsDateString()
  observedAt!: string;

  @ApiPropertyOptional({ enum: EVIDENCE_CLASSIFICATIONS })
  @IsOptional()
  @IsIn(EVIDENCE_CLASSIFICATIONS)
  classification?: EvidenceClassificationValue;
}
