import { UserRole } from '../../generated/prisma';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  brandId!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  createdById?: string;
}
