import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { MembershipRole, MembershipStatus } from '@revn/db';

const ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER', 'GUEST'];
const STATUSES: MembershipStatus[] = ['ACTIVE', 'SUSPENDED', 'REMOVED'];

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: MembershipRole;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: MembershipStatus;
}
