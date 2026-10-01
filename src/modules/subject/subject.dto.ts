import { Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Trim } from "common/transformer";

export class CreateSubjectDto {
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name: string;

  @IsOptional()
  @IsString({ message: "Code must be a string" })
  @Trim()
  code?: string;

  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @Trim()
  description?: string;

  @IsOptional()
  @IsString({ message: "Class ID must be a string" })
  @Trim()
  classId?: string;

  @IsOptional()
  @IsString({ message: "Teacher ID must be a string" })
  @Trim()
  teacherId?: string;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name?: string;

  @IsOptional()
  @IsString({ message: "Code must be a string" })
  @Trim()
  code?: string;

  @IsOptional()
  @IsString({ message: "Description must be a string" })
  @Trim()
  description?: string;

  @IsOptional()
  @IsString({ message: "Class ID must be a string" })
  @Trim()
  classId?: string;

  @IsOptional()
  @IsString({ message: "Teacher ID must be a string" })
  @Trim()
  teacherId?: string;
}

export class SubjectListQueryDto {
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
  @IsString({ message: "Class ID must be a string" })
  @Trim()
  classId?: string;

  @IsOptional()
  @IsString({ message: "Teacher ID must be a string" })
  @Trim()
  teacherId?: string;

  @IsOptional()
  @IsIn(["name", "code", "createdAt"], { message: "Sort by must be one of: name, code, createdAt" })
  sortBy?: "name" | "code" | "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sort order must be asc or desc" })
  sortOrder?: "asc" | "desc" = "desc";
}
