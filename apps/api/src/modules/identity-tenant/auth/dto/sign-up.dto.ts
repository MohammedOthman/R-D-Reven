import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignUpDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters.' })
  @MaxLength(128)
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}
