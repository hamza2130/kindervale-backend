import { Type } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Trim } from "common/transformer";

export class CreateParentDto {
  @IsOptional()
  @IsString({ message: "User ID must be a string" })
  @Trim()
  userId?: string;

  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name: string;

  @IsEmail({}, { message: "Email must be valid" })
  @Trim()
  email: string;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;
}

export class UpdateParentDto {
  @IsOptional()
  @IsString({ message: "User ID must be a string" })
  @Trim()
  userId?: string;

  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: "Email must be valid" })
  @Trim()
  email?: string;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;
}

export class ParentListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Page must be an integer" })
  @Min(1, { message: "Page must be at least 1" })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Limit must be an integer" })
  @Min(1, { message: "Limit must be at least 1" })
  @Max(100, { message: "Limit cannot exceed 100" })
  limit?: number = 10;

  @IsOptional()
  @IsString({ message: "Search must be a string" })
  @Trim()
  search?: string;

  @IsOptional()
  @IsIn(["name", "email", "createdAt"], { message: "Sort by must be one of: name, email, createdAt" })
  sortBy?: "name" | "email" | "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sort order must be asc or desc" })
  sortOrder?: "asc" | "desc" = "desc";
}
