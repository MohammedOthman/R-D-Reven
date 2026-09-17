import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const RULE_TYPES = ['ELIGIBILITY', 'ATTRIBUTION'] as const;

export class CreateCommercialRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: RULE_TYPES })
  @IsIn(RULE_TYPES)
  type!: (typeof RULE_TYPES)[number];
}
