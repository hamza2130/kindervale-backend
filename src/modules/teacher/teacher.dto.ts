import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: "Salary must be a number" })
  @Min(0, { message: "Salary cannot be negative" })
  salary?: number;

  // If true, this teacher becomes the homeroom teacher of `className` (matched by class name --
  // the form only knows the class it just assigned via className above, not a separate classId).
  @IsOptional()
  @Transform(({ value }) => (value === "true" || value === true ? true : value === "false" || value === false ? false : value))
  @IsBoolean({ message: "makeHomeroom must be a boolean" })
  makeHomeroom?: boolean;
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

  // Salary is set once at creation (CreateTeacherDto) but is deliberately absent here: after
  // that, only the Accountant may change it, through UpdateTeacherSalaryDto below. Admin's
  // regular PATCH /teachers/:id can no longer touch it.
  @IsOptional()
  @Transform(({ value }) => (value === "true" || value === true ? true : value === "false" || value === false ? false : value))
  @IsBoolean({ message: "makeHomeroom must be a boolean" })
  makeHomeroom?: boolean;
}

/** The only field the Accountant's dedicated salary-management screen may change. */
export class UpdateTeacherSalaryDto {
  @Type(() => Number)
  @IsNumber({}, { message: "Salary must be a number" })
  @Min(0, { message: "Salary cannot be negative" })
  salary: number;
}

/**
 * What a teacher may change on their own profile via PATCH /teachers/me. Deliberately excludes
 * salary, className, homeroom (makeHomeroom), attendance and userId -- a teacher editing their
 * own record must never be able to give themselves a raise, move themselves to another class,
 * mark themselves present, or repoint the profile at a different account.
 */
export class SelfUpdateTeacherDto {
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @Trim()
  name?: string;

  @IsOptional()
  @IsString({ message: "Phone must be a string" })
  @Trim()
  phone?: string;

  @IsOptional()
  @IsString({ message: "Qualifications must be a string" })
  @Trim()
  qualifications?: string;

  @IsOptional()
  @IsString({ message: "Bio must be a string" })
  @Trim()
  bio?: string;
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

  // A departed teacher's profile is archived (their login is revoked) rather than deleted, so
  // their salary/attendance history stays intact. Excluded from the default list; pass this to
  // see them for the "Archived" filter.
  @IsOptional()
  @Transform(({ value }) => (value === "true" || value === true ? true : value === "false" || value === false ? false : value))
  @IsBoolean({ message: "includeArchived must be a boolean" })
  includeArchived?: boolean;
}
