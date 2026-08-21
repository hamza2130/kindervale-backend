import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Trim } from "common/transformer";
import { teacherAttendanceEnum, type TeacherAttendance } from "models/teachers";

export class CreateTeacherDto {
  @IsString({ message: "User ID must be a string" })
  @Trim()
  userId: string;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;

  @IsString({ message: "Subject must be a string" })
  @Trim()
  subject: string;

  @IsString({ message: "Class name must be a string" })
  @Trim()
  className: string;

  @IsOptional()
  @IsString({ message: "Qualifications must be a string" })
  @Trim()
  qualifications?: string;

  @IsOptional()
  @IsString({ message: "Bio must be a string" })
  @Trim()
  bio?: string;

  @IsOptional()
  @IsEnum(teacherAttendanceEnum.enumValues, {
    message: `Attendance must be one of: ${teacherAttendanceEnum.enumValues.join(", ")}`
  })
  attendance?: TeacherAttendance;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsString({ message: "User ID must be a string" })
  @Trim()
  userId?: string;

  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  name?: string;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;

  @IsOptional()
  @IsString({ message: "Subject must be a string" })
  @Trim()
  subject?: string;

  @IsOptional()
  @IsString({ message: "Class name must be a string" })
  @Trim()
  className?: string;

  @IsOptional()
  @IsString({ message: "Qualifications must be a string" })
  @Trim()
  qualifications?: string;

  @IsOptional()
  @IsString({ message: "Bio must be a string" })
  @Trim()
  bio?: string;

  @IsOptional()
  @IsEnum(teacherAttendanceEnum.enumValues, {
    message: `Attendance must be one of: ${teacherAttendanceEnum.enumValues.join(", ")}`
  })
  attendance?: TeacherAttendance;
}

export class TeacherListQueryDto {
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
  @IsString({ message: "Subject must be a string" })
  @Trim()
  subject?: string;

  @IsOptional()
  @IsString({ message: "Class name must be a string" })
  @Trim()
  className?: string;

  @IsOptional()
  @IsEnum(teacherAttendanceEnum.enumValues, {
    message: `Attendance must be one of: ${teacherAttendanceEnum.enumValues.join(", ")}`
  })
  attendance?: TeacherAttendance;

  @IsOptional()
  @IsIn(["subject", "className", "attendance", "createdAt"], {
    message: "Sort by must be one of: subject, className, attendance, createdAt"
  })
  sortBy?: "subject" | "className" | "attendance" | "createdAt" = "createdAt";

  @IsOptional()
  @IsIn(["asc", "desc"], { message: "Sort order must be asc or desc" })
  sortOrder?: "asc" | "desc" = "desc";
}
