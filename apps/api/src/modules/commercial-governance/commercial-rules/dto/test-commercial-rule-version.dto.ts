import { ArrayMinSize, IsArray, IsBoolean, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// RULE-02: "test rule against historical/sample events before approval."
// No real Revenue Event exists yet (v2 item 14) — these are user-supplied
// sample cases instead, see docs/DECISIONS.md.
class TestCaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @ApiProperty()
  @IsObject()
  input!: Record<string, unknown>;

  @ApiProperty()
  @IsBoolean()
  expectedResult!: boolean;
}

export class TestCommercialRuleVersionDto {
  @ApiProperty({ type: [TestCaseDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  cases!: TestCaseDto[];
}
