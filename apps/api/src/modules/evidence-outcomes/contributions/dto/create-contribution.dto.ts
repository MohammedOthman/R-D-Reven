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

export class CreateContributionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  partnershipId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  initiativeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outcomeId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type!: string;

  /** Defaults to the acting user when omitted. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiProperty()
  @IsDateString()
  observedAt!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  narrative!: string;

  @ApiPropertyOptional({ enum: EVIDENCE_CLASSIFICATIONS })
  @IsOptional()
  @IsIn(EVIDENCE_CLASSIFICATIONS)
  classification?: EvidenceClassificationValue;
}
