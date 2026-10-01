import { Type } from "class-transformer";
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Trim } from "common/transformer";

// C-20/A12: class capacity 99999 and a section capacity of 50 inside a 10-seat class were both
// accepted. This bounds a single class/section to a sane preschool size; the class<->section
// cross-check lives in classroom.service.ts since it needs to read the parent class's capacity.
const MAX_CAPACITY = 500;

export class CreateClassDto {
  // C-20/QA-019: Trim() runs before validation, so a whitespace-only name becomes "" and
  // IsNotEmpty correctly rejects it.
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name: string;

  @IsString({ message: "Teacher must be a string" })
  @Trim()
  teacher: string;

  @IsOptional()
  @IsString({ message: "Homeroom teacher ID must be a string" })
  @Trim()
  homeroomTeacherId?: string;

  @IsOptional()
  @IsString({ message: "Academic year must be a string" })
  @Trim()
  academicYear?: string;

  @IsOptional()
  @IsIn(["Kindervale", "Daycare"], { message: "Portal must be Kindervale or Daycare" })
  portal?: "Kindervale" | "Daycare";

  @Type(() => Number)
  @IsInt({ message: "Capacity must be an integer" })
  @Min(1, { message: "Capacity must be at least 1" })
  @Max(MAX_CAPACITY, { message: `Capacity cannot exceed ${MAX_CAPACITY}` })
  capacity: number;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name?: string;

  @IsOptional()
  @IsString({ message: "Teacher must be a string" })
  @Trim()
  teacher?: string;

  @IsOptional()
  @IsString({ message: "Homeroom teacher ID must be a string" })
  @Trim()
  homeroomTeacherId?: string;

  @IsOptional()
  @IsString({ message: "Academic year must be a string" })
  @Trim()
  academicYear?: string;

  @IsOptional()
  @IsIn(["Kindervale", "Daycare"], { message: "Portal must be Kindervale or Daycare" })
  portal?: "Kindervale" | "Daycare";

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Capacity must be an integer" })
  @Min(1, { message: "Capacity must be at least 1" })
  @Max(MAX_CAPACITY, { message: `Capacity cannot exceed ${MAX_CAPACITY}` })
  capacity?: number;
}

export class ClassListQueryDto {
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
  @IsString({ message: "Academic year must be a string" })
  @Trim()
  academicYear?: string;

  @IsOptional()
  @IsIn(["name", "teacher", "capacity", "createdAt"], {
    message: "Sort by must be one of: name, teacher, capacity, createdAt"
  })
  sortBy?: "name" | "teacher" | "capacity" | "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sort order must be asc or desc" })
  sortOrder?: "asc" | "desc" = "desc";
}

export class CreateSectionDto {
  @IsString({ message: "Class ID must be a string" })
  @Trim()
  classId: string;

  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Capacity must be an integer" })
  @Min(1, { message: "Capacity must be at least 1" })
  @Max(MAX_CAPACITY, { message: `Capacity cannot exceed ${MAX_CAPACITY}` })
  capacity?: number;
}

export class UpdateSectionDto {
  @IsOptional()
  @IsString({ message: "Class ID must be a string" })
  @Trim()
  classId?: string;

  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  @IsNotEmpty({ message: "Name cannot be empty" })
  @MaxLength(100, { message: "Name is too long (max 100 characters)" })
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Capacity must be an integer" })
  @Min(1, { message: "Capacity must be at least 1" })
  @Max(MAX_CAPACITY, { message: `Capacity cannot exceed ${MAX_CAPACITY}` })
  capacity?: number;
}

export class SectionListQueryDto {
  @IsOptional()
  @IsString({ message: "Class ID must be a string" })
  @Trim()
  classId?: string;

  @IsOptional()
  @IsString({ message: "Search must be a string" })
  @Trim()
  search?: string;
}
