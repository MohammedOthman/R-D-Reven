import { IsDateString, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** INIT-03: "members or referenced counterpart owners" — at least one of `assigneeUserId`/`assigneeExternalName` is required (checked in the service, not here). */
export class CreateActionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  assigneeExternalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
