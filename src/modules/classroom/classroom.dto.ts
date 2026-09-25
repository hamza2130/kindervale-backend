import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Trim } from "common/transformer";

export class CreateClassDto {
  @IsString({ message: "Name must be a string" })
  @Trim()
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
  capacity: number;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
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
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Capacity must be an integer" })
  @Min(1, { message: "Capacity must be at least 1" })
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
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "Capacity must be an integer" })
  @Min(1, { message: "Capacity must be at least 1" })
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
