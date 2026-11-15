import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PilotSessionDto {
  @ApiPropertyOptional({ enum: ['OWNER', 'EXECUTIVE', 'REVIEWER'] })
  @IsOptional()
  @IsIn(['OWNER', 'EXECUTIVE', 'REVIEWER'])
  role?: 'OWNER' | 'EXECUTIVE' | 'REVIEWER';
}
