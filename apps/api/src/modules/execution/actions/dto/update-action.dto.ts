import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ActionStatus } from '@revn/db';

const STATUSES: ActionStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];

export class UpdateActionDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: ActionStatus;

  /** Required by the service when moving `status` to BLOCKED. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  blockerReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

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
