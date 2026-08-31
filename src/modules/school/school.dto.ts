import { PartialType } from "@nestjs/mapped-types";
import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min } from "class-validator";
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  scholarship?: number;

  @IsDateString()
  dueDate: string;

  @IsEnum(feeStatusEnum.enumValues)
  status: FeeStatus;
}

export class UpdateFeeDto extends PartialType(CreateFeeDto) {}

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
  @Matches(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i, {
    message: "dayOfWeek must be a valid day name (e.g. Monday)"
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
}

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}

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

  @IsOptional()
  @IsString()
  @Trim()
  meals?: string;

  @IsOptional()
  @IsString()
  @Trim()
  nap?: string;

  @IsOptional()
  @IsString()
  @Trim()
  activities?: string;

  @IsOptional()
  @IsString()
  @Trim()
  notes?: string;

  @IsOptional()
  @IsString()
  @Trim()
  mood?: string;

  @IsOptional()
  @IsString()
  @Trim()
  arrival?: string;

  @IsOptional()
  @IsString()
  @Trim()
  snack?: string;

  @IsOptional()
  @IsString()
  @Trim()
  departure?: string;
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
