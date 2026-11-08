import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EVIDENCE_CLASSIFICATIONS, type EvidenceClassificationValue } from '../../classification';

// EVD-04: replacing evidence creates a new version — it never overwrites
// the prior material file.
export class ReplaceEvidenceDto {
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
