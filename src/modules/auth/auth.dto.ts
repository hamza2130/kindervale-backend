import { Transform } from "class-transformer";
import { IsEmail, IsIn, IsOptional, IsString, Length, MinLength, ValidateIf } from "class-validator";
import { normalizePortalRole } from "common/role-normalizer";
import { Trim } from "common/transformer";

export const portalRoles = ["admin", "daycare_admin", "principal", "teacher", "parent", "accountant"] as const;
export type PortalRole = (typeof portalRoles)[number];

export class LoginDto {
  @ValidateIf((dto: LoginDto) => !dto.username)
  @IsEmail({}, { message: "Email must be valid" })
  @Trim()
  email?: string;

  @ValidateIf((dto: LoginDto) => !dto.email)
  @IsString({ message: "Username must be a string" })
  @Trim()
  username?: string;

  @IsString({ message: "Password must be a string" })
  @MinLength(6, { message: "Password must be at least 6 characters" })
  password: string;

  @Transform(({ value }) => normalizePortalRole(value))
  @IsIn(portalRoles, { message: `Role must be one of: ${portalRoles.join(", ")}` })
  role: PortalRole;
}

export class RefreshTokenDto {
  @ValidateIf((dto: RefreshTokenDto) => !dto.token && !dto.refresh_token)
  @IsString({ message: "Refresh token must be a string" })
  refreshToken?: string;

  @IsOptional()
  @IsString({ message: "Token must be a string" })
  token?: string;

  @IsOptional()
  @IsString({ message: "Refresh token must be a string" })
  refresh_token?: string;
}

export class LogoutDto {
  @IsOptional()
  @IsString({ message: "Refresh token must be a string" })
  refreshToken?: string;

  @IsOptional()
  @IsString({ message: "Token must be a string" })
  token?: string;

  @IsOptional()
  @IsString({ message: "Refresh token must be a string" })
  refresh_token?: string;
}

export class ForgotPasswordDto {
  @IsString({ message: "Username must be a string" })
  @Trim()
  username: string;

  @IsEmail({}, { message: "Email must be valid" })
  @Trim()
  email: string;
}

export class ResetPasswordDto {
  @ValidateIf((dto: ResetPasswordDto) => !dto.username)
  @IsEmail({}, { message: "Email must be valid" })
  @Trim()
  email?: string;

  @ValidateIf((dto: ResetPasswordDto) => !dto.email)
  @IsString({ message: "Username must be a string" })
  @Trim()
  username?: string;

  @IsString({ message: "OTP must be a string" })
  @Length(4, 6, { message: "OTP must be 4 to 6 digits" })
  otp: string;

  @IsString({ message: "Password must be a string" })
  @MinLength(6, { message: "Password must be at least 6 characters" })
  newPassword: string;

  @IsOptional()
  @IsString({ message: "Confirm password must be a string" })
  confirmNewPassword?: string;
}

export class ChangePasswordDto {
  @IsString({ message: "Current password must be a string" })
  currentPassword: string;

  @IsString({ message: "New password must be a string" })
  @MinLength(6, { message: "New password must be at least 6 characters" })
  newPassword: string;

  @IsOptional()
  @IsString({ message: "Confirm password must be a string" })
  confirmNewPassword?: string;
}
