import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
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

  // C-20/DC-09/QA-019: Trim() runs before validation, so a whitespace-only "   " becomes "" here
  // and IsNotEmpty correctly rejects it -- previously accepted and showed up as a blank-name
  // child in dropdowns.
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name: string;

  @IsString({ message: "Class name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Class name cannot be empty" })
  className: string;

  @IsOptional()
  @IsString({ message: "Section must be a string" })
  @Trim()
  section?: string;

  // Daycare children (Infant/Toddler rooms) have their age collected in months rather than
  // years, so this bound has to be wide enough to cover both units (e.g. a 2-month-old infant,
  // or an 18-year-old in the regular preschool).
  @Type(() => Number)
  @IsInt({ message: "Age must be an integer" })
  @Min(0, { message: "Age cannot be negative" })
  @Max(216, { message: "Age cannot exceed 216" })
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
  @IsString({ message: "Blood group must be a string" })
  @Trim()
  @MaxLength(5, { message: "Blood group is too long" })
  bloodGroup?: string;

  @IsOptional()
  @IsString({ message: "Address must be a string" })
  @Trim()
  @MaxLength(500, { message: "Address is too long (max 500 characters)" })
  address?: string;

  @IsOptional()
  @IsString({ message: "Emergency contact name must be a string" })
  @Trim()
  @MaxLength(100, { message: "Emergency contact name is too long (max 100 characters)" })
  emergencyContactName?: string;

  @IsOptional()
  @IsString({ message: "Emergency contact phone must be a string" })
  @Trim()
  @MaxLength(30, { message: "Emergency contact phone is too long (max 30 characters)" })
  emergencyContactPhone?: string;

  // Source for the circular photo an End-of-Year report card shows (see common/report-template.ts
  // consumers) -- optional, a student with none gets a plain avatar fallback.
  @IsOptional()
  @IsString({ message: "Photo URL must be a string" })
  @Trim()
  photoUrl?: string;

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
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name?: string;

  @IsOptional()
  @IsString({ message: "Class name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Class name cannot be empty" })
  className?: string;

  @IsOptional()
  @IsString({ message: "Section must be a string" })
  @Trim()
  section?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Age must be an integer" })
  @Min(0, { message: "Age cannot be negative" })
  @Max(216, { message: "Age cannot exceed 216" })
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
  @IsString({ message: "Blood group must be a string" })
  @Trim()
  @MaxLength(5, { message: "Blood group is too long" })
  bloodGroup?: string;

  @IsOptional()
  @IsString({ message: "Address must be a string" })
  @Trim()
  @MaxLength(500, { message: "Address is too long (max 500 characters)" })
  address?: string;

  @IsOptional()
  @IsString({ message: "Emergency contact name must be a string" })
  @Trim()
  @MaxLength(100, { message: "Emergency contact name is too long (max 100 characters)" })
  emergencyContactName?: string;

  @IsOptional()
  @IsString({ message: "Emergency contact phone must be a string" })
  @Trim()
  @MaxLength(30, { message: "Emergency contact phone is too long (max 30 characters)" })
  emergencyContactPhone?: string;

  @IsOptional()
  @IsString({ message: "Photo URL must be a string" })
  @Trim()
  photoUrl?: string;

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

  // A withdrawn/left student is archived (their attendance/fees/report-card history stays,
  // any login they had is revoked) rather than deleted. Excluded from the default list; pass
  // this to see them under the "Archived" filter.
  @IsOptional()
  @Transform(({ value }) => (value === "true" || value === true ? true : value === "false" || value === false ? false : value))
  @IsBoolean({ message: "includeArchived must be a boolean" })
  includeArchived?: boolean;
}
