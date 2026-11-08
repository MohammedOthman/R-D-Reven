import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * PORT-03: "Create relationship under partner/program with owner, sponsor,
 * objective, motion and cadence." Program doesn't exist as an entity yet
 * (deliberately deferred — see docs/DECISIONS.md), so it's omitted here.
 * Every field is optional at creation — Table 67 only starts gating `owner`
 * from the Qualified stage onward, and a brand-new relationship starts at
 * Prospect.
 */
export class CreatePartnershipDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sponsorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  motion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objective?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cadence?: string;
}
