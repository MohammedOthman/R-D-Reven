import { IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { MembershipRole } from '@revn/db';

const ROLES: MembershipRole[] = ['OWNER', 'ADMIN', 'EXECUTIVE', 'MANAGER', 'REVIEWER', 'GUEST'];

export class CreateInvitationDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES)
  role!: MembershipRole;
}
