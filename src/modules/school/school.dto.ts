import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";
import { Trim } from "common/transformer";
import {
  documentTypeEnum,
  feeStatusEnum,
  leaveStatusEnum,
  notificationAudienceEnum,
  reviewStatusEnum,
  type DocumentType,
  type FeeStatus,
  type LeaveStatus,
  type NotificationAudience,
  type ReviewStatus
} from "models/school";
import { teacherAttendanceEnum, type TeacherAttendance } from "models/teachers";

// HH:mm, 24-hour clock (matches the "24 hour clock" convention already used elsewhere, e.g. the
// class-photo expiry window).
export const TIME_HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class CreateFeeDto {
  @IsString()
  @Trim()
  invoice: string;

  @IsString()
  @Trim()
  studentId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  // A percentage, not an amount -- 0..100. Was @Min(0) only (C-20/ACC-08), so a 150% "scholarship"
  // was accepted and silently produced a negative net fee.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  scholarship?: number;

  @IsDateString()
  dueDate: string;

  @IsEnum(feeStatusEnum.enumValues)
  status: FeeStatus;
}

export class UpdateFeeDto extends PartialType(CreateFeeDto) {}

export class VoidFeeDto {
  @IsOptional()
  @IsString()
  @Trim()
  reason?: string;
}

export class CreateFeeStructureDto {
  @IsString()
  @Trim()
  className: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;
}

export class UpdateFeeStructureDto extends PartialType(CreateFeeStructureDto) {}

// C-20: this route took @Body() dto: any -- a bad status or a garbage time string reached the
// database directly and came back as a raw 500. Cross-field checks (arrival before departure,
// times only present for PRESENT/LATE) stay in the service, since class-validator can't easily
// express "these two fields relative to a third" without a custom decorator.
export class StaffAttendanceRecordDto {
  @IsString()
  @Trim()
  teacherId: string;

  @IsEnum(teacherAttendanceEnum.enumValues, {
    message: `Status must be one of: ${teacherAttendanceEnum.enumValues.join(", ")}`
  })
  status: TeacherAttendance;

  @IsOptional()
  @Matches(TIME_HH_MM, { message: "Arrival time must be in HH:mm (24-hour) format" })
  arrivalTime?: string;

  @IsOptional()
  @Matches(TIME_HH_MM, { message: "Departure time must be in HH:mm (24-hour) format" })
  departureTime?: string;

  @IsOptional()
  @IsString()
  @Trim()
  @MaxLength(500)
  remarks?: string;
}

export class StaffAttendanceQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @Trim()
  teacherId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class BulkMarkStaffAttendanceDto {
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StaffAttendanceRecordDto)
  records: StaffAttendanceRecordDto[];
}

export class FinancialReportQueryDto {
  @IsOptional()
  @IsIn(["Kindervale", "Daycare"], { message: "Portal must be Kindervale or Daycare" })
  portal?: "Kindervale" | "Daycare";

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CreateExamDto {
  @IsString()
  @Trim()
  title: string;

  @IsString()
  @Trim()
  subject: string;

  @IsString()
  @Trim()
  className: string;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxMarks: number;
}

export class UpdateExamDto extends PartialType(CreateExamDto) {}

export class CreateReportCardDto {
  @IsString()
  @Trim()
  studentId: string;

  @IsString()
  @Trim()
  term: string;

  @IsString()
  @Trim()
  className: string;

  @IsString()
  @Trim()
  academicYear: string;

  @IsOptional()
  @IsString()
  @Trim()
  summary?: string;

  @IsOptional()
  @IsString()
  @Trim()
  fileUrl?: string;

  @IsOptional()
  @IsEnum(reviewStatusEnum.enumValues)
  status?: ReviewStatus;
}

export class UpdateReportCardDto extends PartialType(CreateReportCardDto) {}

export class CreateCalendarEventDto {
  @IsString()
  @Trim()
  title: string;

  @IsDateString()
  date: string;

  @IsString()
  @Trim()
  type: string;
}

export class UpdateCalendarEventDto extends PartialType(CreateCalendarEventDto) {}

export class CreateTimetableDto {
  @IsString()
  @Trim()
  className: string;

  @IsString()
  @Trim()
  @Matches(/^(Mon(day)?|Tue(sday)?|Wed(nesday)?|Thu(rsday)?|Fri(day)?|Sat(urday)?|Sun(day)?)$/i, {
    message: "dayOfWeek must be a valid day name (e.g. Monday or Mon)"
  })
  dayOfWeek: string;

  @IsString()
  @Trim()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be in HH:mm format (00:00–23:59)" })
  startTime: string;

  @IsString()
  @Trim()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be in HH:mm format (00:00–23:59)" })
  endTime: string;

  @IsString()
  @Trim()
  subject: string;

  @IsOptional()
  @IsString()
  @Trim()
  classId?: string;

  @IsOptional()
  @IsString()
  @Trim()
  teacherId?: string;

  @IsOptional()
  @IsString()
  @Trim()
  room?: string;
}

export class UpdateTimetableDto extends PartialType(CreateTimetableDto) {}

export class CreateDocumentDto {
  @IsOptional()
  file?: unknown;

  @IsString()
  @Trim()
  title: string;

  @IsOptional()
  @IsString()
  @Trim()
  description?: string;

  @IsOptional()
  @IsEnum(documentTypeEnum.enumValues)
  type?: DocumentType;

  @IsOptional()
  @IsString()
  @Trim()
  fileUrl?: string;

  @IsOptional()
  @IsEnum(notificationAudienceEnum.enumValues)
  audience?: NotificationAudience;

  @IsOptional()
  @IsString()
  @Trim()
  studentId?: string;

  @IsOptional()
  @IsString()
  @Trim()
  activity?: string;

  @IsOptional()
  @IsString()
  @Trim()
  caption?: string;

  @IsOptional()
  @IsString()
  @Trim()
  classId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** Which portal feature the file was attached from (bookList, yearlyPlan, teacherDocument, ...). */
  @IsOptional()
  @IsString()
  @Trim()
  kind?: string;

  @IsOptional()
  @IsString()
  @Trim()
  scope?: string;

  @IsOptional()
  @IsString()
  @Trim()
  subject?: string;

  @IsOptional()
  @IsString()
  @Trim()
  cls?: string;

  @IsOptional()
  @IsString()
  @Trim()
  teacher?: string;
}

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}

export class CreateWeeklyObjectiveDto {
  @IsOptional()
  @IsString()
  @Trim()
  classId?: string;

  @IsString()
  @Trim()
  className: string;

  @IsString()
  @Trim()
  week: string;

  @IsString()
  @Trim()
  message: string;
}

export class UpdateWeeklyObjectiveDto extends PartialType(CreateWeeklyObjectiveDto) {}

export class ReviewWeeklyObjectiveDto {
  @IsEnum(reviewStatusEnum.enumValues)
  status: ReviewStatus;

  @IsOptional()
  @IsString()
  @Trim()
  reviewRemarks?: string;
}

export class SubmitHomeworkDto {
  @IsString()
  @Trim()
  studentId: string;

  @IsOptional()
  @IsString()
  @Trim()
  note?: string;
}

export class CreateLeaveRequestDto {
  @IsOptional()
  @IsString()
  @Trim()
  userId?: string;

  @IsOptional()
  @IsString()
  @Trim()
  studentId?: string;

  @IsOptional()
  @IsString()
  @Trim()
  type?: string;

  @IsOptional()
  @IsString()
  @Trim()
  addedBy?: string;

  @IsDateString()
  fromDate: string;

  @IsDateString()
  toDate: string;

  @IsString()
  @Trim()
  reason: string;

  @IsOptional()
  @IsEnum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"])
  status?: LeaveStatus;
}

export class UpdateLeaveRequestDto extends PartialType(CreateLeaveRequestDto) {}

export class ReviewLeaveRequestDto {
  @IsEnum(["APPROVED", "REJECTED", "CANCELLED"])
  status: LeaveStatus;

  @IsOptional()
  @IsString()
  @Trim()
  reviewRemarks?: string;
}

export class CreateExpenseDto {
  @IsString()
  @Trim()
  title: string;

  @IsString()
  @Trim()
  category: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;

  @IsOptional()
  @IsString()
  @Trim()
  portal?: string;
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

export class CreateIncomeDto {
  @IsString()
  @Trim()
  title: string;

  @IsOptional()
  @IsString()
  @Trim()
  category?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  /** Date the money was received. */
  @IsDateString()
  date: string;

  /** Inclusive range the payment covers — omit both for a one-off receipt. */
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsString()
  @Trim()
  portal?: string;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;
}

export class UpdateIncomeDto extends PartialType(CreateIncomeDto) {}

export class CreateFaqDto {
  @IsString()
  @Trim()
  question: string;

  @IsString()
  @Trim()
  answer: string;

  @IsOptional()
  @IsEnum(notificationAudienceEnum.enumValues)
  audience?: NotificationAudience;
}

export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class CreateSchoolPolicyDto {
  @IsString()
  @Trim()
  title: string;

  @IsString()
  @Trim()
  content: string;

  @IsOptional()
  @IsString()
  @Trim()
  fileUrl?: string;

  @IsOptional()
  @IsEnum(notificationAudienceEnum.enumValues)
  audience?: NotificationAudience;
}

export class UpdateSchoolPolicyDto extends PartialType(CreateSchoolPolicyDto) {}

export class CreateDaycareReportDto {
  @IsString()
  @Trim()
  studentId: string;

  @IsDateString()
  date: string;

  // C-20/DC-13: these were unbounded free text -- a 20k-character "note" was accepted and
  // rendered as a single ~117000px-wide line in the parent/admin view. 2000 chars is generous
  // for a daily report entry while ruling out that kind of accidental/abusive paste.
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Meals note is too long (max 2000 characters)" })
  @Trim()
  meals?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Nap note is too long (max 2000 characters)" })
  @Trim()
  nap?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Activities note is too long (max 2000 characters)" })
  @Trim()
  activities?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Notes are too long (max 2000 characters)" })
  @Trim()
  notes?: string;

  @IsOptional()
  @IsIn(["Happy", "Average", "Fussy", "Sick"], { message: "Mood must be one of: Happy, Average, Fussy, Sick" })
  mood?: string;

  @IsOptional()
  @IsString()
  @Trim()
  arrival?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Snack note is too long (max 2000 characters)" })
  @Trim()
  snack?: string;

  @IsOptional()
  @IsString()
  @Trim()
  departure?: string;

  // Structured "Today I ate / drank / napped / diaper changes / items needed" sections from the
  // paper daily-report form. Loosely typed on purpose — this mirrors the rest of this file's
  // pragmatic style rather than adding a deep nested-DTO hierarchy for a handful of sub-fields.
  @IsOptional()
  @IsObject()
  details?: Record<string, unknown>;
}

export class UpdateDaycareReportDto extends PartialType(CreateDaycareReportDto) {}

export class CreateDaycareResourceDto {
  @IsString()
  @Trim()
  title: string;

  @IsOptional()
  @IsString()
  @Trim()
  description?: string;

  @IsOptional()
  @IsString()
  @Trim()
  fileUrl?: string;
}

export class UpdateDaycareResourceDto extends PartialType(CreateDaycareResourceDto) {}

export class CreateBackupDto {
  @IsString()
  @Trim()
  type: string;
}

export class CreateNotificationDto {
  @IsString()
  @Trim()
  title: string;

  @IsString()
  @Trim()
  body: string;

  @IsDateString()
  date: string;

  @IsEnum(notificationAudienceEnum.enumValues)
  audience: NotificationAudience;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}

export class UpsertSettingsDto {
  @IsString()
  @Trim()
  schoolName: string;

  @IsString()
  @Trim()
  academicYear: string;

  @IsString()
  @Trim()
  timezone: string;
}
