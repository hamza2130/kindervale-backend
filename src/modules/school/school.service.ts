import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, type SQL } from "drizzle-orm";
import { ParamDto } from "common/common.dto";
import { createId } from "@paralleldrive/cuid2";
import { type Response } from "express";
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import {
  calendarEventsTable,
  attendanceTable,
  backupsTable,
  classesTable,
  daycareReportsTable,
  daycareResourcesTable,
  documentsTable,
  examsTable,
  expensesTable,
  faqsTable,
  feesTable,
  leaveRequestsTable,
  notificationsTable,
  parentsTable,
  homeworkSubmissionsTable,
  notificationReadsTable,
  reportCardsTable,
  weeklyObjectivesTable,
  schoolPoliciesTable,
  settingsTable,
  studentsTable,
  timetablesTable
} from "models/school";
import teachersTable from "models/teachers";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";
import {
  CreateCalendarEventDto,
  CreateBackupDto,
  CreateDaycareReportDto,
  CreateDaycareResourceDto,
  CreateDocumentDto,
  CreateExamDto,
  CreateExpenseDto,
  CreateFaqDto,
  CreateFeeDto,
  CreateLeaveRequestDto,
  CreateNotificationDto,
  CreateReportCardDto,
  CreateSchoolPolicyDto,
  CreateTimetableDto,
  CreateWeeklyObjectiveDto,
  ReviewWeeklyObjectiveDto,
  SubmitHomeworkDto,
  UpdateWeeklyObjectiveDto,
  ReviewLeaveRequestDto,
  UpdateCalendarEventDto,
  UpdateDaycareReportDto,
  UpdateDaycareResourceDto,
  UpdateDocumentDto,
  UpdateExamDto,
  UpdateExpenseDto,
  UpdateFaqDto,
  UpdateFeeDto,
  UpdateLeaveRequestDto,
  UpdateNotificationDto,
  UpdateReportCardDto,
  UpdateSchoolPolicyDto,
  UpdateTimetableDto,
  UpsertSettingsDto
} from "modules/school/school.dto";

type TableWithId = typeof parentsTable;

@Injectable()
export class SchoolService {
  constructor(private readonly databaseService: DatabaseService) {}

  async dashboard() {
    const [students, teachers, fees, notifications] = await Promise.all([
      this.getStudents(),
      this.databaseService.db.select().from(teachersTable),
      this.getFees(),
      this.getNotifications()
    ]);

    const pendingFees = fees.filter((fee) => fee.status !== "PAID").reduce((sum, fee) => sum + Number(fee.amount), 0);
    const attendance = students.length
      ? Math.round(students.reduce((sum, student) => sum + student.attendance, 0) / students.length)
      : 0;

    return {
      stats: {
        students: students.length,
        teachers: teachers.length,
        attendance,
        pendingFees
      },
      notifications
    };
  }

  getStudents() {
    return this.databaseService.db.select().from(studentsTable);
  }

  createFee(dto: CreateFeeDto) {
    return this.insert(feesTable, { ...dto, amount: dto.amount.toString() }, "fee");
  }

  getFees() {
    return this.databaseService.db.select().from(feesTable);
  }

  getFee(id: string) {
    return this.findOne(feesTable, id, "Fee");
  }

  updateFee(id: string, dto: UpdateFeeDto) {
    return this.update(feesTable, id, { ...dto, amount: dto.amount?.toString() }, "Fee");
  }

  deleteFee(id: string) {
    return this.delete(feesTable, id, "Fee");
  }

  createExam(dto: CreateExamDto) {
    return this.insert(examsTable, dto, "exam");
  }

  getExams() {
    return this.databaseService.db.select().from(examsTable);
  }

  getExam(id: string) {
    return this.findOne(examsTable, id, "Exam");
  }

  updateExam(id: string, dto: UpdateExamDto) {
    return this.update(examsTable, id, dto, "Exam");
  }

  deleteExam(id: string) {
    return this.delete(examsTable, id, "Exam");
  }

  createReportCard(dto: CreateReportCardDto, createdBy?: string) {
    return this.insert(reportCardsTable, { ...dto, createdBy }, "report card");
  }

  getReportCards() {
    return this.databaseService.db.select().from(reportCardsTable);
  }

  getReportCard(id: string) {
    return this.findOne(reportCardsTable, id, "Report card");
  }

  updateReportCard(id: string, dto: UpdateReportCardDto) {
    return this.update(reportCardsTable, id, dto, "Report card");
  }

  publishReportCard(id: string) {
    return this.update(reportCardsTable, id, { status: "APPROVED", publishedAt: new Date() }, "Report card");
  }

  deleteReportCard(id: string) {
    return this.delete(reportCardsTable, id, "Report card");
  }

  createCalendarEvent(dto: CreateCalendarEventDto) {
    return this.insert(calendarEventsTable, dto, "calendar event");
  }

  getCalendarEvents() {
    return this.databaseService.db.select().from(calendarEventsTable);
  }

  getCalendarEvent(id: string) {
    return this.findOne(calendarEventsTable, id, "Calendar event");
  }

  updateCalendarEvent(id: string, dto: UpdateCalendarEventDto) {
    return this.update(calendarEventsTable, id, dto, "Calendar event");
  }

  deleteCalendarEvent(id: string) {
    return this.delete(calendarEventsTable, id, "Calendar event");
  }

  async createTimetable(dto: CreateTimetableDto) {
    // Check for time-slot conflict: same class + same day + overlapping time
    const conflicts = await this.databaseService.db
      .select({ id: timetablesTable.id })
      .from(timetablesTable)
      .where(
        and(
          eq(timetablesTable.className, dto.className),
          eq(timetablesTable.dayOfWeek, dto.dayOfWeek),
          eq(timetablesTable.startTime, dto.startTime)
        )
      )
      .limit(1);
    if (conflicts.length > 0) {
      throw new ConflictException(
        `Time slot ${dto.startTime} on ${dto.dayOfWeek} is already taken for ${dto.className}`
      );
    }
    return this.insert(timetablesTable, dto, "timetable");
  }

  getTimetables() {
    return this.databaseService.db.select().from(timetablesTable);
  }

  getTimetable(id: string) {
    return this.findOne(timetablesTable, id, "Timetable");
  }

  updateTimetable(id: string, dto: UpdateTimetableDto) {
    return this.update(timetablesTable, id, dto, "Timetable");
  }

  deleteTimetable(id: string) {
    return this.delete(timetablesTable, id, "Timetable");
  }

  createDocument(dto: CreateDocumentDto, uploadedBy?: string) {
    if (!dto.fileUrl) throw new BadRequestException("File URL is required");
    return this.insert(documentsTable, { ...dto, fileUrl: dto.fileUrl, uploadedBy }, "document");
  }

  async uploadDocument(file: any, dto: CreateDocumentDto, uploadedBy?: string) {
    if (!file?.buffer || !file?.originalname) throw new BadRequestException("File is required");

    const fileId = createId();
    const originalName = basename(String(file.originalname));
    const filename = `${fileId}${extname(originalName)}`;
    const storageDir = join(process.cwd(), "storage", "documents");
    await mkdir(storageDir, { recursive: true });
    await writeFile(join(storageDir, filename), file.buffer);

    const metadata = {
      originalName,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size,
      activity: dto.activity,
      caption: dto.caption,
      classId: dto.classId,
      expiresAt: dto.expiresAt,
      kind: dto.kind,
      scope: dto.scope,
      subject: dto.subject,
      cls: dto.cls,
      teacher: dto.teacher
    };

    return this.createDocument(
      {
        ...dto,
        title: dto.title || originalName,
        fileUrl: `/storage/documents/${filename}`,
        description: JSON.stringify(metadata)
      },
      uploadedBy
    );
  }

  getDocuments(query: { type?: string; uploadedBy?: string } = {}) {
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(documentsTable.type, query.type as any));
    if (query.uploadedBy) conditions.push(eq(documentsTable.uploadedBy, query.uploadedBy));
    return this.databaseService.db.select().from(documentsTable).where(conditions.length ? and(...conditions) : undefined);
  }

  getDocument(id: string) {
    return this.findOne(documentsTable, id, "Document");
  }

  async streamDocument(id: string, response: Response) {
    const document = await this.getDocument(id);
    const metadata = this.parseDocumentMetadata(document.description);
    const filePath = join(process.cwd(), document.fileUrl.replace(/^\/?storage[\\/]/, "storage/"));
    response.setHeader("Content-Type", metadata.mimeType || "application/octet-stream");
    response.setHeader("Content-Disposition", `inline; filename="${metadata.originalName || document.title}"`);
    createReadStream(filePath).pipe(response);
  }

  updateDocument(id: string, dto: UpdateDocumentDto) {
    return this.update(documentsTable, id, dto, "Document");
  }

  deleteDocument(id: string) {
    return this.delete(documentsTable, id, "Document");
  }

  private parseDocumentMetadata(description?: string | null): Record<string, any> {
    if (!description) return {};
    try {
      return JSON.parse(description);
    } catch {
      return {};
    }
  }

  async createLeaveRequest(dto: CreateLeaveRequestDto, role?: string, authenticatedUserId?: string) {
    const normalizedRole = role?.toUpperCase();
    const isAdminCreated =
      normalizedRole === "ADMIN" || normalizedRole === "DAYCAREADMIN" || normalizedRole === "PRINCIPAL";
    // Admins may file a request on somebody else's behalf, so the request stays owned by that
    // person. Everyone else can only ever file their own leave.
    const userId = isAdminCreated ? (dto.userId ?? authenticatedUserId) : authenticatedUserId;
    if (!userId) {
      throw new BadRequestException("Authenticated user is required to create a leave request");
    }
    const status = isAdminCreated ? (dto.status ?? "PENDING") : "PENDING";
    const leave = await this.insert(
      leaveRequestsTable,
      {
        ...dto,
        userId,
        fromDate: dto.fromDate.slice(0, 10),
        toDate: dto.toDate.slice(0, 10),
        status
      },
      "leave request"
    );
    if (status === "APPROVED") {
      await this.applyApprovedStudentLeaveSideEffects(leave, authenticatedUserId ?? userId);
    }
    return leave;
  }

  getLeaveRequests(filter?: { userId?: string; role?: string }) {
    const role = filter?.role?.toUpperCase();
    const query = this.databaseService.db
      .select({
        id: leaveRequestsTable.id,
        userId: leaveRequestsTable.userId,
        studentId: leaveRequestsTable.studentId,
        type: leaveRequestsTable.type,
        addedBy: leaveRequestsTable.addedBy,
        fromDate: leaveRequestsTable.fromDate,
        toDate: leaveRequestsTable.toDate,
        reason: leaveRequestsTable.reason,
        status: leaveRequestsTable.status,
        reviewRemarks: leaveRequestsTable.reviewRemarks,
        reviewedBy: leaveRequestsTable.reviewedBy,
        reviewedAt: leaveRequestsTable.reviewedAt,
        createdAt: leaveRequestsTable.createdAt,
        updatedAt: leaveRequestsTable.updatedAt,
        applicant: usersTable.name,
        applicantEmail: usersTable.email,
        studentName: studentsTable.name,
        className: studentsTable.className
      })
      .from(leaveRequestsTable)
      .leftJoin(usersTable, eq(leaveRequestsTable.userId, usersTable.id))
      .leftJoin(studentsTable, eq(leaveRequestsTable.studentId, studentsTable.id))
      .$dynamic();

    // Teachers and parents only ever see the requests they filed themselves; admins and the
    // principal see the whole queue.
    if ((role === "TEACHER" || role === "PARENT") && filter?.userId) {
      return query.where(eq(leaveRequestsTable.userId, filter.userId));
    }

    return query;
  }

  getLeaveRequest(id: string) {
    return this.findOne(leaveRequestsTable, id, "Leave request");
  }

  updateLeaveRequest(id: string, dto: UpdateLeaveRequestDto) {
    return this.update(leaveRequestsTable, id, dto, "Leave request");
  }

  async reviewLeaveRequest(id: string, dto: ReviewLeaveRequestDto, reviewedBy?: string) {
    const current = await this.getLeaveRequest(id);
    const leave = await this.update(leaveRequestsTable, id, { ...dto, reviewedBy, reviewedAt: new Date() }, "Leave request");
    if (dto.status === "APPROVED" && current.status !== "APPROVED") {
      await this.applyApprovedStudentLeaveSideEffects(leave, reviewedBy);
    } else if (dto.status !== "APPROVED" && current.status === "APPROVED") {
      await this.clearApprovedStudentLeaveSideEffects(leave);
    }
    return leave;
  }

  deleteLeaveRequest(id: string) {
    return this.delete(leaveRequestsTable, id, "Leave request");
  }

  createExpense(dto: CreateExpenseDto, createdBy?: string) {
    return this.insert(expensesTable, { ...dto, amount: dto.amount.toString(), createdBy }, "expense");
  }

  getExpenses() {
    return this.databaseService.db.select().from(expensesTable);
  }

  getExpense(id: string) {
    return this.findOne(expensesTable, id, "Expense");
  }

  updateExpense(id: string, dto: UpdateExpenseDto) {
    return this.update(expensesTable, id, { ...dto, amount: dto.amount?.toString() }, "Expense");
  }

  deleteExpense(id: string) {
    return this.delete(expensesTable, id, "Expense");
  }

  createFaq(dto: CreateFaqDto) {
    return this.insert(faqsTable, dto, "FAQ");
  }

  getFaqs() {
    return this.databaseService.db.select().from(faqsTable);
  }

  getFaq(id: string) {
    return this.findOne(faqsTable, id, "FAQ");
  }

  updateFaq(id: string, dto: UpdateFaqDto) {
    return this.update(faqsTable, id, dto, "FAQ");
  }

  deleteFaq(id: string) {
    return this.delete(faqsTable, id, "FAQ");
  }

  createSchoolPolicy(dto: CreateSchoolPolicyDto) {
    return this.insert(schoolPoliciesTable, { ...dto, publishedAt: new Date() }, "school policy");
  }

  getSchoolPolicies() {
    return this.databaseService.db.select().from(schoolPoliciesTable);
  }

  getSchoolPolicy(id: string) {
    return this.findOne(schoolPoliciesTable, id, "School policy");
  }

  updateSchoolPolicy(id: string, dto: UpdateSchoolPolicyDto) {
    return this.update(schoolPoliciesTable, id, dto, "School policy");
  }

  deleteSchoolPolicy(id: string) {
    return this.delete(schoolPoliciesTable, id, "School policy");
  }

  createDaycareReport(dto: CreateDaycareReportDto, createdBy?: string) {
    return this.insert(daycareReportsTable, { ...dto, createdBy }, "daycare report");
  }

  getDaycareReports() {
    return this.databaseService.db.select().from(daycareReportsTable);
  }

  getDaycareReport(id: string) {
    return this.findOne(daycareReportsTable, id, "Daycare report");
  }

  updateDaycareReport(id: string, dto: UpdateDaycareReportDto) {
    return this.update(daycareReportsTable, id, dto, "Daycare report");
  }

  deleteDaycareReport(id: string) {
    return this.delete(daycareReportsTable, id, "Daycare report");
  }

  createDaycareResource(dto: CreateDaycareResourceDto, createdBy?: string) {
    return this.insert(daycareResourcesTable, { ...dto, createdBy }, "daycare resource");
  }

  getDaycareResources() {
    return this.databaseService.db.select().from(daycareResourcesTable);
  }

  getDaycareResource(id: string) {
    return this.findOne(daycareResourcesTable, id, "Daycare resource");
  }

  updateDaycareResource(id: string, dto: UpdateDaycareResourceDto) {
    return this.update(daycareResourcesTable, id, dto, "Daycare resource");
  }

  deleteDaycareResource(id: string) {
    return this.delete(daycareResourcesTable, id, "Daycare resource");
  }

  createBackup(dto: CreateBackupDto, requestedBy?: string) {
    return this.insert(backupsTable, { ...dto, requestedBy }, "backup request");
  }

  getBackups() {
    return this.databaseService.db.select().from(backupsTable);
  }

  getBackup(id: string) {
    return this.findOne(backupsTable, id, "Backup");
  }

  createNotification(dto: CreateNotificationDto) {
    return this.insert(notificationsTable, dto, "notification");
  }

  getNotifications() {
    return this.databaseService.db.select().from(notificationsTable);
  }

  getNotification(id: string) {
    return this.findOne(notificationsTable, id, "Notification");
  }

  updateNotification(id: string, dto: UpdateNotificationDto) {
    return this.update(notificationsTable, id, dto, "Notification");
  }

  deleteNotification(id: string) {
    return this.delete(notificationsTable, id, "Notification");
  }

  async getSettings() {
    const [settings] = await this.databaseService.db.select().from(settingsTable).limit(1);
    return settings ?? null;
  }

  async upsertSettings(dto: UpsertSettingsDto) {
    const [settings] = await this.databaseService.db.select({ id: settingsTable.id }).from(settingsTable).limit(1);
    if (!settings) return this.insert(settingsTable, dto, "settings");
    return this.update(settingsTable, settings.id, dto, "Settings");
  }

  // ---------------------------------------------------------------- homework hand-ins
  /** Recording a hand-in twice is a no-op rather than an error. */
  async submitHomework(homeworkId: string, dto: SubmitHomeworkDto, submittedBy?: string) {
    const [existing] = await this.databaseService.db
      .select({ id: homeworkSubmissionsTable.id })
      .from(homeworkSubmissionsTable)
      .where(
        and(
          eq(homeworkSubmissionsTable.homeworkId, homeworkId),
          eq(homeworkSubmissionsTable.studentId, dto.studentId)
        )
      )
      .limit(1);

    if (existing) {
      return this.update(
        homeworkSubmissionsTable,
        existing.id,
        { note: dto.note, submittedBy, submittedAt: new Date() },
        "Homework submission"
      );
    }

    return this.insert(
      homeworkSubmissionsTable,
      { homeworkId, studentId: dto.studentId, note: dto.note, submittedBy },
      "homework submission"
    );
  }

  getHomeworkSubmissions(studentId?: string) {
    const query = this.databaseService.db.select().from(homeworkSubmissionsTable).$dynamic();
    return studentId ? query.where(eq(homeworkSubmissionsTable.studentId, studentId)) : query;
  }

  // ---------------------------------------------------------------- notification read state
  /** Notifications carry an audience, so read state has to be tracked per person. */
  async getNotificationsForUser(userId?: string) {
    const notifications = await this.getNotifications();
    if (!userId) return notifications.map((notification) => ({ ...notification, read: false }));

    const reads = await this.databaseService.db
      .select({ notificationId: notificationReadsTable.notificationId })
      .from(notificationReadsTable)
      .where(eq(notificationReadsTable.userId, userId));
    const readIds = new Set(reads.map((row) => row.notificationId));

    return notifications.map((notification) => ({ ...notification, read: readIds.has(notification.id) }));
  }

  async markNotificationRead(notificationId: string, userId: string) {
    await this.databaseService.db
      .insert(notificationReadsTable)
      .values({ notificationId, userId })
      .onConflictDoNothing();
    return { read: true };
  }

  async markAllNotificationsRead(userId: string) {
    const notifications = await this.getNotifications();
    if (!notifications.length) return { read: 0 };
    await this.databaseService.db
      .insert(notificationReadsTable)
      .values(notifications.map((notification) => ({ notificationId: notification.id, userId })))
      .onConflictDoNothing();
    return { read: notifications.length };
  }

  // ---------------------------------------------------------------- weekly objectives
  /** Re-submitting the same week replaces the previous entry rather than stacking duplicates,
   *  which also keeps teachers on CREATE-only access. */
  async createWeeklyObjective(dto: CreateWeeklyObjectiveDto, teacherId: string) {
    const [existing] = await this.databaseService.db
      .select({ id: weeklyObjectivesTable.id })
      .from(weeklyObjectivesTable)
      .where(
        and(
          eq(weeklyObjectivesTable.teacherId, teacherId),
          eq(weeklyObjectivesTable.className, dto.className),
          eq(weeklyObjectivesTable.week, dto.week)
        )
      )
      .limit(1);

    if (existing) {
      return this.update(
        weeklyObjectivesTable,
        existing.id,
        { ...dto, status: "PENDING", reviewRemarks: null, reviewedBy: null, reviewedAt: null },
        "Weekly objective"
      );
    }

    return this.insert(weeklyObjectivesTable, { ...dto, teacherId, status: "PENDING" }, "weekly objective");
  }

  getWeeklyObjectives() {
    return this.databaseService.db
      .select({
        id: weeklyObjectivesTable.id,
        teacherId: weeklyObjectivesTable.teacherId,
        classId: weeklyObjectivesTable.classId,
        className: weeklyObjectivesTable.className,
        week: weeklyObjectivesTable.week,
        message: weeklyObjectivesTable.message,
        status: weeklyObjectivesTable.status,
        reviewRemarks: weeklyObjectivesTable.reviewRemarks,
        createdAt: weeklyObjectivesTable.createdAt,
        updatedAt: weeklyObjectivesTable.updatedAt,
        teacher: usersTable.name
      })
      .from(weeklyObjectivesTable)
      .leftJoin(usersTable, eq(weeklyObjectivesTable.teacherId, usersTable.id));
  }

  updateWeeklyObjective(id: string, dto: UpdateWeeklyObjectiveDto) {
    return this.update(weeklyObjectivesTable, id, { ...dto, status: "PENDING" }, "Weekly objective");
  }

  reviewWeeklyObjective(id: string, dto: ReviewWeeklyObjectiveDto, reviewedBy?: string) {
    return this.update(
      weeklyObjectivesTable,
      id,
      { ...dto, reviewedBy, reviewedAt: new Date() },
      "Weekly objective"
    );
  }

  deleteWeeklyObjective(id: string) {
    return this.delete(weeklyObjectivesTable, id, "Weekly objective");
  }

  private async insert(table: any, dto: object, label: string) {
    const records = (await this.databaseService.db.insert(table).values(dto).returning()) as unknown[];
    const [record] = records;
    if (!record) throw new ConflictException(`Failed to create ${label}`);
    return record;
  }

  private async findOne(table: TableWithId | any, id: ParamDto["id"], label: string) {
    const [record] = await this.databaseService.db.select().from(table).where(eq(table.id, id)).limit(1);
    if (!record) throw new NotFoundException(`${label} not found`);
    return record;
  }

  private async update(table: TableWithId | any, id: string, dto: object, label: string) {
    const [record] = await this.databaseService.db
      .update(table)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(table.id, id))
      .returning();
    if (!record) throw new NotFoundException(`${label} not found`);
    return record;
  }

  private async delete(table: TableWithId | any, id: string, label: string) {
    const result = await this.databaseService.db.delete(table).where(eq(table.id, id)).returning({ id: table.id });
    if (!result.length) throw new NotFoundException(`${label} not found`);
    return { deleted: true };
  }

  private async applyApprovedStudentLeaveSideEffects(leave: any, actorUserId?: string) {
    if (!leave?.studentId) return;

    const [student] = await this.databaseService.db
      .select()
      .from(studentsTable)
      .where(eq(studentsTable.id, leave.studentId))
      .limit(1);
    if (!student) throw new NotFoundException("Student not found");

    const [classRoom] = await this.databaseService.db
      .select()
      .from(classesTable)
      .where(eq(classesTable.name, student.className))
      .limit(1);

    const [teacher] = await this.databaseService.db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
        className: teachersTable.className,
        name: usersTable.name
      })
      .from(teachersTable)
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(teachersTable.className, student.className))
      .limit(1);

    const dates = this.inclusiveDateRange(leave.fromDate, leave.toDate || leave.fromDate);
    for (const date of dates) {
      const [existing] = await this.databaseService.db
        .select({ id: attendanceTable.id })
        .from(attendanceTable)
        .where(and(eq(attendanceTable.studentId, student.id), eq(attendanceTable.date, date)))
        .limit(1);

      const attendanceValue = {
        classId: classRoom?.id ?? null,
        status: "EXCUSED" as const,
        remarks: `Approved leave: ${leave.type || "Leave"}`,
        markedBy: actorUserId,
        updatedAt: new Date()
      };

      if (existing) {
        await this.databaseService.db.update(attendanceTable).set(attendanceValue).where(eq(attendanceTable.id, existing.id));
      } else {
        await this.databaseService.db.insert(attendanceTable).values({
          studentId: student.id,
          classId: classRoom?.id ?? null,
          date,
          status: "EXCUSED",
          remarks: attendanceValue.remarks,
          markedBy: actorUserId
        });
      }
    }

    await this.databaseService.db.insert(notificationsTable).values({
      title: "Student leave approved",
      body: `${student.name}'s leave from ${leave.fromDate} to ${leave.toDate || leave.fromDate} was approved.${teacher?.userId ? ` Teacher user: ${teacher.userId}.` : ""}`,
      date: new Date().toISOString().slice(0, 10),
      audience: "TEACHER"
    });
  }

  private async clearApprovedStudentLeaveSideEffects(leave: any) {
    if (!leave?.studentId) return;

    const dates = this.inclusiveDateRange(leave.fromDate, leave.toDate || leave.fromDate);
    for (const date of dates) {
      await this.databaseService.db
        .delete(attendanceTable)
        .where(
          and(
            eq(attendanceTable.studentId, leave.studentId),
            eq(attendanceTable.date, date),
            eq(attendanceTable.status, "EXCUSED")
          )
        );
    }
  }

  private inclusiveDateRange(fromDate: string, toDate: string) {
    const dates: string[] = [];
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      throw new BadRequestException("Invalid leave date range");
    }
    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      dates.push(date.toISOString().slice(0, 10));
    }
    return dates;
  }
}
