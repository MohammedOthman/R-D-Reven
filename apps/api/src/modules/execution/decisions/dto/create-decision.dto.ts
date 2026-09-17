import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDecisionDto {
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

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  rationale!: string;

  /** Defaults to the acting user when omitted. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deciderId?: string;

  @ApiProperty()
  @IsDateString()
  effectiveDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  impact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  initiativeId?: string;

  /** DEC-02: a restricted decision needs an authorized approver who isn't its own creator before it's final. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}
