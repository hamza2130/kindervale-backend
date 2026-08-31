import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Trim } from "common/transformer";
import { feeStatusEnum, type FeeStatus } from "models/school";

export class CreateStudentDto {
  @IsOptional()
  @IsString({ message: "Admission number must be a string" })
  @Trim()
  admissionNo?: string;

  @IsOptional()
  @IsString({ message: "User ID must be a string" })
  @Trim()
  userId?: string;

  @IsOptional()
  @IsString({ message: "Parent ID must be a string" })
  @Trim()
  parentId?: string;

  @IsString({ message: "Name must be a string" })
  @Trim()
  name: string;

  @IsString({ message: "Class name must be a string" })
  @Trim()
  className: string;

  @Type(() => Number)
  @IsInt({ message: "Age must be an integer" })
  @Min(2, { message: "Age must be at least 2" })
  @Max(18, { message: "Age cannot exceed 18" })
  age: number;

  @IsOptional()
  @IsDateString({}, { message: "Birthday must be a valid date" })
  birthday?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Attendance must be an integer" })
  @Min(0, { message: "Attendance cannot be less than 0" })
  @Max(100, { message: "Attendance cannot exceed 100" })
  attendance?: number;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;

  @IsOptional()
  @IsEnum(feeStatusEnum.enumValues, {
    message: `Fee status must be one of: ${feeStatusEnum.enumValues.join(", ")}`
  })
  feeStatus?: FeeStatus;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString({ message: "Admission number must be a string" })
  @Trim()
  admissionNo?: string;

  @IsOptional()
  @IsString({ message: "User ID must be a string" })
  @Trim()
  userId?: string;

  @IsOptional()
  @IsString({ message: "Parent ID must be a string" })
  @Trim()
  parentId?: string;

  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  name?: string;

  @IsOptional()
  @IsString({ message: "Class name must be a string" })
  @Trim()
  className?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Age must be an integer" })
  @Min(1, { message: "Age must be at least 1" })
  age?: number;

  @IsOptional()
  @IsDateString({}, { message: "Birthday must be a valid date" })
  birthday?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Attendance must be an integer" })
  @Min(0, { message: "Attendance cannot be less than 0" })
  @Max(100, { message: "Attendance cannot exceed 100" })
  attendance?: number;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;

  @IsOptional()
  @IsEnum(feeStatusEnum.enumValues, {
    message: `Fee status must be one of: ${feeStatusEnum.enumValues.join(", ")}`
  })
  feeStatus?: FeeStatus;
}

export class StudentListQueryDto {
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
  @IsString({ message: "Class name must be a string" })
  @Trim()
  className?: string;

  @IsOptional()
  @IsString({ message: "Parent ID must be a string" })
  @Trim()
  parentId?: string;

  @IsOptional()
  @IsEnum(feeStatusEnum.enumValues, {
    message: `Fee status must be one of: ${feeStatusEnum.enumValues.join(", ")}`
  })
  feeStatus?: FeeStatus;

  @IsOptional()
  @IsIn(["name", "admissionNo", "className", "age", "attendance", "createdAt"], {
    message: "Sort by must be one of: name, admissionNo, className, age, attendance, createdAt"
  })
  sortBy?: "name" | "admissionNo" | "className" | "age" | "attendance" | "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sort order must be asc or desc" })
  sortOrder?: "asc" | "desc" = "desc";
}
