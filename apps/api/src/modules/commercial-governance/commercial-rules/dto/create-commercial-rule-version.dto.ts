import { IsDateString, IsInt, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommercialRuleVersionDto {
  /** { combinator: 'AND' | 'OR', conditions: [{ field, operator, value }] } — validated in the service against the approved operator catalog (RULE-01). */
  @ApiProperty()
  @IsObject()
  definition!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  precedence?: number;

  @ApiProperty()
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
