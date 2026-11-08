import {
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOutcomeDto {
  @ApiProperty()
  @IsUUID()
  partnershipId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  initiativeId?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  type!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  claimedResult!: string;

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
