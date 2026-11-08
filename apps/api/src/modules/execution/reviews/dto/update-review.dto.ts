import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { ReviewNotesClassification, ReviewStage } from '@revn/db';

const STAGES: ReviewStage[] = [
  'SCHEDULED',
  'IN_PREPARATION',
  'IN_PROGRESS',
  'COMPLETED',
  'REOPENED',
];
const CLASSIFICATIONS: ReviewNotesClassification[] = ['INTERNAL', 'SHAREABLE'];

export class UpdateReviewDto {
  /** The version the client last read — PRD §4.1 optimistic concurrency. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({ enum: STAGES })
  @IsOptional()
  @IsIn(STAGES)
  stage?: ReviewStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  period?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  participantUserIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  notes?: string;

  @ApiPropertyOptional({ enum: CLASSIFICATIONS })
  @IsOptional()
  @IsIn(CLASSIFICATIONS)
  notesClassification?: ReviewNotesClassification;

  /** Required (with `stage: COMPLETED`) — REV-05/T-008's "next cadence handling." Also propagated onto the parent Partnership's own `nextReviewAt`. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextReviewAt?: string;
}
