import { staffAttendanceTable } from "models/school";
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { expiredClassPhotoSql, isExpiredClassPhoto } from "modules/school/class-photo";
import {
  assertExactPortalAccess,
  assertHomeroomAccess,
  assertHomeroomForCreate,
  assertPortalAccess,
  assertPortalForCreate,
  callerPortal,
  classNameToPortal,
  homeroomFilterCondition,
  type HomeroomCaller,
  type SchoolPortal
} from "common/portal-scope";
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
  incomeTable,
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
  CreateIncomeDto,
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
  UpdateIncomeDto,
  UpdateFaqDto,
  UpdateFeeDto,
  VoidFeeDto,
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

  async createFee(dto: CreateFeeDto, requestingUser?: { userId: string; role: string }) {
    await this.assertStudentPortalAccess(requestingUser, dto.studentId, "Student not found");
    // Absolute, not portal-scoped: Accountant isn't confined by callerPortal at all, so without
    // this a daycare child could get a fee invoice from anyone. Daycare is never billed per
    // child -- payment is a lump sum recorded through the income ledger instead (decision 3).
    const [student] = await this.databaseService.db
      .select({ className: studentsTable.className })
      .from(studentsTable)
      .where(eq(studentsTable.id, dto.studentId))
      .limit(1);
    if (!student) throw new NotFoundException("Student not found");
    if (classNameToPortal(student.className) === "Daycare") {
      throw new BadRequestException("Daycare children are not billed per invoice; record the lump-sum payment as income instead.");
    }
    return this.insert(
      feesTable,
      { ...dto, amount: dto.amount.toString(), dueDate: this.forceDueDateToThe15th(dto.dueDate), issuedAt: new Date() },
      "fee"
    );
  }

  /** Decision 3: a fee is always due the 15th of whatever month it's for -- the day is never
   *  client-chosen, only the year/month (taken from whatever date the caller sent). */
  private forceDueDateToThe15th(dateStr: string): string {
    const [year, month] = dateStr.slice(0, 7).split("-");
    return `${year}-${month}-15`;
  }

  async getFees(requestingUser?: { userId: string; role: string }) {
    const rows = await this.databaseService.db.select().from(feesTable);
    return this.scopeRowsToParent(rows, requestingUser);
  }

  async getFee(id: string, requestingUser?: { userId: string; role: string }) {
    const fee = await this.findOne(feesTable, id, "Fee");
    // Reported as not-found rather than forbidden -- ids aren't secret, and a distinct "you
    // can't see this one" response would let a parent confirm which invoice ids exist at all.
    const [scoped] = await this.scopeRowsToParent([fee], requestingUser);
    if (!scoped) throw new NotFoundException("Fee not found");
    return scoped;
  }

  async updateFee(id: string, dto: UpdateFeeDto, requestingUser?: { userId: string; role: string }) {
    await this.assertExistingRowPortalAccess(feesTable, id, requestingUser, "Fee not found");
    // VOID is only ever set through voidFee() below, which also stamps voidedAt/voidReason --
    // going through the generic PATCH would leave those unset.
    if (dto.status === "VOID") {
      throw new BadRequestException("Use POST /fees/:id/void to void an invoice");
    }
    return this.update(
      feesTable,
      id,
      { ...dto, amount: dto.amount?.toString(), dueDate: dto.dueDate ? this.forceDueDateToThe15th(dto.dueDate) : undefined },
      "Fee"
    );
  }

  async deleteFee(id: string, requestingUser?: { userId: string; role: string }) {
    await this.assertExistingRowPortalAccess(feesTable, id, requestingUser, "Fee not found");
    return this.delete(feesTable, id, "Fee");
  }

  /**
   * Decision 4's void/credit-note capability: cancels/corrects a wrongly-issued invoice without
   * deleting it -- the row and its history (any payments already recorded against it) stay, only
   * status/voidedAt/voidReason change. A voided invoice is excluded from outstanding-balance
   * totals everywhere that already filters by status !== "PAID" (fee collection reports,
   * dashboards) since "VOID" is neither "PAID" nor a real amount owed -- those call sites will
   * need a small follow-up to also exclude VOID explicitly rather than lump it in with pending.
   */
  async voidFee(id: string, dto: VoidFeeDto, requestingUser?: { userId: string; role: string }) {
    await this.assertExistingRowPortalAccess(feesTable, id, requestingUser, "Fee not found");
    return this.update(feesTable, id, { status: "VOID", voidedAt: new Date(), voidReason: dto.reason }, "Fee");
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

  createReportCard(dto: CreateReportCardDto, createdBy?: string, requestingUser?: HomeroomCaller) {
    // Decision 7: a teacher may only write a report card for their own homeroom class.
    assertHomeroomForCreate(requestingUser, dto.className);
    return this.insert(reportCardsTable, { ...dto, createdBy }, "report card");
  }

  async getReportCards(requestingUser?: { userId: string; role: string; homeroomClassName?: string | null }) {
    const rows = await this.databaseService.db.select().from(reportCardsTable);
    // Decision 7: a teacher sees only report cards for their own homeroom class.
    return this.scopeRowsToHomeroom(await this.scopeRowsToParent(rows, requestingUser), requestingUser);
  }

  async getReportCard(id: string, requestingUser?: { userId: string; role: string; homeroomClassName?: string | null }) {
    const reportCard = await this.findOne(reportCardsTable, id, "Report card");
    const [scoped] = this.scopeRowsToHomeroom(await this.scopeRowsToParent([reportCard], requestingUser), requestingUser);
    if (!scoped) throw new NotFoundException("Report card not found");
    return scoped;
  }

  async updateReportCard(id: string, dto: UpdateReportCardDto, requestingUser?: HomeroomCaller) {
    const [existing] = await this.databaseService.db.select({ className: reportCardsTable.className }).from(reportCardsTable).where(eq(reportCardsTable.id, id)).limit(1);
    if (!existing) throw new NotFoundException("Report card not found");
    assertHomeroomAccess(requestingUser, existing.className, "Report card not found");
    if (dto.className !== undefined) assertHomeroomForCreate(requestingUser, dto.className);
    // Approval is exclusively through publishReportCard() below (decision 7: "admin approves the
    // reports") -- status is dropped here so a teacher editing their own draft through the same
    // form/PATCH can never self-approve by just including it in the body.
    const { status, ...rest } = dto;
    return this.update(reportCardsTable, id, rest, "Report card");
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

  // Gated on "calendar" READ (not a "timetables" module -- there isn't one), which TEACHER
  // already has. Unscoped until now: a teacher could see every class's timetable, not just their
  // own (decision 7).
  getTimetables(requestingUser?: HomeroomCaller) {
    const homeroomCondition = homeroomFilterCondition(timetablesTable.className, requestingUser);
    const query = this.databaseService.db.select().from(timetablesTable);
    return homeroomCondition ? query.where(homeroomCondition) : query;
  }

  async getTimetable(id: string, requestingUser?: HomeroomCaller) {
    const timetable = await this.findOne(timetablesTable, id, "Timetable");
    assertHomeroomAccess(requestingUser, timetable.className, "Timetable not found");
    return timetable;
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

  async uploadDocument(file: any, dto: CreateDocumentDto, uploadedBy?: string, uploaderRole?: string) {
    if (!file?.buffer || !file?.originalname) throw new BadRequestException("File is required");

    // Class photos previously had only a client-side check tying the upload to the teacher's own
    // homeroom -- trivially bypassed by calling this endpoint directly. Admin/Principal/Daycare
    // Admin aren't uploading "as" a homeroom teacher, so this only applies to TEACHER callers.
    if (dto.kind === "classPhoto" && (uploaderRole ?? "").trim().toUpperCase() === "TEACHER" && dto.cls) {
      const [classRoom] = await this.databaseService.db
        .select({ homeroomTeacherId: classesTable.homeroomTeacherId })
        .from(classesTable)
        .where(eq(classesTable.name, dto.cls))
        .limit(1);
      if (!classRoom || classRoom.homeroomTeacherId !== uploadedBy) {
        throw new ForbiddenException("You can only upload photos for your own homeroom class");
      }
    }
    // Daycare has no teacher logins -- its class photos are uploaded by the Daycare Admin
    // directly. The permission grant alone doesn't stop them tagging a photo as a Kindervale
    // class, so that's enforced here the same way create/update already is for students/teachers.
    // Scoped to Daycare Admin specifically (not Admin, who may manage class photos for either
    // portal) via assertPortalForCreate's own role check.
    if (dto.kind === "classPhoto" && dto.cls && (uploaderRole ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "") === "DAYCAREADMIN") {
      assertPortalForCreate(uploaderRole, dto.cls);
    }

    const originalName = basename(String(file.originalname));
    const mimeType = file.mimetype || "application/octet-stream";

    // Store file content as a data: URL in the database so it survives
    // container restarts (Render free tier has ephemeral filesystem).
    const base64 = Buffer.from(file.buffer).toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const metadata = {
      originalName,
      mimeType,
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
        fileUrl: dataUrl,
        description: JSON.stringify(metadata)
      },
      uploadedBy
    );
  }

  getDocuments(query: { type?: string; uploadedBy?: string } = {}) {
    const conditions: SQL[] = [];
    if (query.type) conditions.push(eq(documentsTable.type, query.type as any));
    if (query.uploadedBy) conditions.push(eq(documentsTable.uploadedBy, query.uploadedBy));
    // Expired class photos are hidden even if the hourly cleanup hasn't removed them yet.
    conditions.push(sql`not (${expiredClassPhotoSql()})`);
    return this.databaseService.db.select().from(documentsTable).where(and(...conditions));
  }

  getDocument(id: string) {
    return this.findOne(documentsTable, id, "Document");
  }

  /**
   * Decision 8: whoever runs a portal may delete its own class photos early (before the 24h
   * auto-expiry). Daycare Admin just gained the "documents" permission module for exactly this --
   * without a resource-level check that grant would also let them delete any Kindervale document
   * (book lists, teacher PDFs, ...), since the documents table carries no portal column of its
   * own. Admin/Principal are unrestricted here, same as every other document-management path.
   */
  async deleteDocument(id: string, requestingUser?: { userId: string; role: string }): Promise<void> {
    const normalizedRole = (requestingUser?.role ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "");
    if (normalizedRole === "DAYCAREADMIN") {
      const document = await this.getDocument(id);
      const meta = this.parseDocumentMetadata(document.description);
      if (meta.kind === "classPhoto" && meta.cls) {
        assertPortalAccess(requestingUser?.role, meta.cls, "Document not found");
      } else if (document.uploadedBy !== requestingUser?.userId) {
        // Not a class photo they can portal-check, and not their own upload -- default to denying
        // rather than assuming it's safe for them to touch.
        throw new NotFoundException("Document not found");
      }
    }
    await this.delete(documentsTable, id, "Document");
  }

  async streamDocument(id: string, response: Response) {
    const document = await this.getDocument(id);
    if (isExpiredClassPhoto(document)) throw new NotFoundException("This photo has expired");
    const metadata = this.parseDocumentMetadata(document.description);
    const contentType = metadata.mimeType || "application/octet-stream";
    const fileName = metadata.originalName || document.title;

    response.setHeader("Content-Type", contentType);
    response.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

    if (document.fileUrl.startsWith("data:")) {
      const commaIdx = document.fileUrl.indexOf(",");
      const base64 = commaIdx >= 0 ? document.fileUrl.slice(commaIdx + 1) : "";
      const buffer = Buffer.from(base64, "base64");
      response.setHeader("Content-Length", String(buffer.length));
      response.end(buffer);
    } else {
      const filePath = join(process.cwd(), document.fileUrl.replace(/^\/?storage[\\/]/, "storage/"));
      createReadStream(filePath).pipe(response);
    }
  }

  updateDocument(id: string, dto: UpdateDocumentDto) {
    return this.update(documentsTable, id, dto, "Document");
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
    // Daycare has no leave-request flow at all -- absence is marked directly by the Daycare Admin
    // within Daily Activity/attendance, never requested by a parent or filed on a child's behalf.
    // This is an absolute block (unlike the portal-scoped checks elsewhere in this file), so it
    // also stops an Admin/Principal from filing one for a daycare child "on behalf" of someone.
    if (dto.studentId) {
      const [student] = await this.databaseService.db
        .select({ className: studentsTable.className })
        .from(studentsTable)
        .where(eq(studentsTable.id, dto.studentId))
        .limit(1);
      if (!student) throw new NotFoundException("Student not found");
      if (classNameToPortal(student.className) === "Daycare") {
        throw new BadRequestException("Daycare children do not have a leave-request flow; absence is marked directly in Daily Activity.");
      }
    }

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

  async getLeaveRequests(filter?: { userId?: string; role?: string }) {
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
        className: studentsTable.className,
        applicantClassName: teachersTable.className
      })
      .from(leaveRequestsTable)
      .leftJoin(usersTable, eq(leaveRequestsTable.userId, usersTable.id))
      .leftJoin(studentsTable, eq(leaveRequestsTable.studentId, studentsTable.id))
      .leftJoin(teachersTable, eq(leaveRequestsTable.userId, teachersTable.userId))
      .$dynamic();

    // Teachers and parents only ever see the requests they filed themselves; admins and the
    // principal see the whole queue -- but an Admin/Daycare Admin's queue is further confined
    // to their own portal below (the UI already filtered this; the API never did, so a Daycare
    // Admin's own token could read, and reviewLeaveRequest below shows it could also approve or
    // reject, a Kindervale staff member's leave request).
    if ((role === "TEACHER" || role === "PARENT") && filter?.userId) {
      return query.where(eq(leaveRequestsTable.userId, filter.userId));
    }

    const required = callerPortal(filter?.role);
    const rows = await query;
    if (!required) return rows;
    return rows.filter((row) => classNameToPortal(row.applicantClassName) === required);
  }

  getLeaveRequest(id: string, requestingUser?: { userId: string; role: string }) {
    return this.findLeaveRequestWithPortalCheck(id, requestingUser);
  }

  async updateLeaveRequest(id: string, dto: UpdateLeaveRequestDto, requestingUser?: { userId: string; role: string }) {
    await this.findLeaveRequestWithPortalCheck(id, requestingUser);
    return this.update(leaveRequestsTable, id, dto, "Leave request");
  }

  async reviewLeaveRequest(
    id: string,
    dto: ReviewLeaveRequestDto,
    reviewedBy?: string,
    requestingUser?: { userId: string; role: string }
  ) {
    const current = await this.findLeaveRequestWithPortalCheck(id, requestingUser);
    const leave = await this.update(leaveRequestsTable, id, { ...dto, reviewedBy, reviewedAt: new Date() }, "Leave request");
    if (dto.status === "APPROVED" && current.status !== "APPROVED") {
      await this.applyApprovedStudentLeaveSideEffects(leave, reviewedBy);
    } else if (dto.status !== "APPROVED" && current.status === "APPROVED") {
      await this.clearApprovedStudentLeaveSideEffects(leave);
    }
    return leave;
  }

  /** Fetches a leave request and, for a portal-confined caller, confirms the staff member who
   * filed it is on their own side -- resolved via the teacher profile linked to the same userId,
   * since leave_requests itself carries no className. */
  private async findLeaveRequestWithPortalCheck(id: string, requestingUser?: { userId: string; role: string }) {
    const leave = await this.findOne(leaveRequestsTable, id, "Leave request");
    if (callerPortal(requestingUser?.role)) {
      const [teacher] = await this.databaseService.db
        .select({ className: teachersTable.className })
        .from(teachersTable)
        .where(eq(teachersTable.userId, leave.userId))
        .limit(1);
      assertPortalAccess(requestingUser?.role, teacher?.className, "Leave request not found");
    }
    return leave;
  }

  async deleteLeaveRequest(id: string, requestingUser?: { userId: string; role: string }) {
    await this.findLeaveRequestWithPortalCheck(id, requestingUser);
    return this.deleteLeaveRequestRow(id);
  }

  private deleteLeaveRequestRow(id: string) {
    return this.delete(leaveRequestsTable, id, "Leave request");
  }

  createExpense(dto: CreateExpenseDto, createdBy?: string, requestingUser?: { userId: string; role: string }) {
    // The DTO's portal field was trusting whatever the client sent, which is exactly the kind
    // of thing this whole pass is closing elsewhere -- an Admin or Daycare Admin's own role
    // determines their portal; it isn't a free-text field they get to fill in themselves.
    // PRINCIPAL (no fixed portal) falls back to whatever was sent, same as before.
    const portal = callerPortal(requestingUser?.role) ?? dto.portal;
    return this.insert(expensesTable, { ...dto, portal, amount: dto.amount.toString(), createdBy }, "expense");
  }

  async getExpenses(requestingUser?: { userId: string; role: string }) {
    const rows = await this.databaseService.db.select().from(expensesTable);
    const required = callerPortal(requestingUser?.role);
    return required ? rows.filter((row) => (row.portal ?? "Kindervale") === required) : rows;
  }

  async getExpense(id: string, requestingUser?: { userId: string; role: string }) {
    const expense = await this.findOne(expensesTable, id, "Expense");
    assertExactPortalAccess(requestingUser?.role, expense.portal, "Expense not found");
    return expense;
  }

  async updateExpense(id: string, dto: UpdateExpenseDto, requestingUser?: { userId: string; role: string }) {
    const existing = await this.findOne(expensesTable, id, "Expense");
    assertExactPortalAccess(requestingUser?.role, existing.portal, "Expense not found");
    // Same as create: portal is derived from who's asking, never taken from the request body.
    const portal = callerPortal(requestingUser?.role) ?? dto.portal;
    return this.update(expensesTable, id, { ...dto, portal, amount: dto.amount?.toString() }, "Expense");
  }

  async deleteExpense(id: string, requestingUser?: { userId: string; role: string }) {
    const existing = await this.findOne(expensesTable, id, "Expense");
    assertExactPortalAccess(requestingUser?.role, existing.portal, "Expense not found");
    return this.delete(expensesTable, id, "Expense");
  }

  createIncome(dto: CreateIncomeDto, createdBy?: string, requestingUser?: { userId: string; role: string }) {
    // Same fix as expenses: portal is derived from the caller's role, never trusted from the
    // request body.
    const portal = callerPortal(requestingUser?.role) ?? dto.portal;
    return this.insert(incomeTable, { ...dto, portal, amount: dto.amount.toString(), createdBy }, "income");
  }

  async getIncome(requestingUser?: { userId: string; role: string }) {
    const rows = await this.databaseService.db.select().from(incomeTable);
    const required = callerPortal(requestingUser?.role);
    return required ? rows.filter((row) => (row.portal ?? "Daycare") === required) : rows;
  }

  async getIncomeEntry(id: string, requestingUser?: { userId: string; role: string }) {
    const entry = await this.findOne(incomeTable, id, "Income entry");
    assertExactPortalAccess(requestingUser?.role, entry.portal, "Income entry not found");
    return entry;
  }

  async updateIncome(id: string, dto: UpdateIncomeDto, requestingUser?: { userId: string; role: string }) {
    const existing = await this.findOne(incomeTable, id, "Income entry");
    assertExactPortalAccess(requestingUser?.role, existing.portal, "Income entry not found");
    const portal = callerPortal(requestingUser?.role) ?? dto.portal;
    return this.update(incomeTable, id, { ...dto, portal, amount: dto.amount?.toString() }, "Income entry");
  }

  async deleteIncome(id: string, requestingUser?: { userId: string; role: string }) {
    const existing = await this.findOne(incomeTable, id, "Income entry");
    assertExactPortalAccess(requestingUser?.role, existing.portal, "Income entry not found");
    return this.delete(incomeTable, id, "Income entry");
  }

  /**
   * The three real reports from the QA pass, replacing the placeholder Reports page: a P&L
   * (fees collected + daycare income, minus expenses), fee collection grouped by the month it was
   * due, and an overdue/defaulters list. Aggregated in JS over the existing, already-scoped
   * getFees()/getExpenses()/getIncome() row sets rather than new raw SQL, since none of this can
   * be exercised against a live database until Neon resets -- a hand-rolled aggregate query with a
   * typo would only ever surface as a 500 in production, not a type error here.
   */
  async getFinancialReports(query: { portal?: SchoolPortal; fromDate?: string; toDate?: string }, requestingUser?: { userId: string; role: string }) {
    const [feeRows, expenseRows, incomeRows, students] = await Promise.all([
      this.databaseService.db
        .select({
          id: feesTable.id,
          invoice: feesTable.invoice,
          studentId: feesTable.studentId,
          amount: feesTable.amount,
          dueDate: feesTable.dueDate,
          status: feesTable.status
        })
        .from(feesTable),
      this.getExpenses(requestingUser),
      this.getIncome(requestingUser),
      this.databaseService.db
        .select({ id: studentsTable.id, name: studentsTable.name, className: studentsTable.className, admissionNo: studentsTable.admissionNo })
        .from(studentsTable)
    ]);

    const studentById = new Map(students.map((student) => [student.id, student]));
    const portalOf = (studentId: string) => classNameToPortal(studentById.get(studentId)?.className);

    const portalFilter = query.portal;
    const inRange = (dateStr: string) => (!query.fromDate || dateStr >= query.fromDate) && (!query.toDate || dateStr <= query.toDate);

    // Every existing fee row from before decision 3 blocked daycare invoicing entirely is still
    // included here if one somehow exists -- this report should reflect what's actually in the
    // ledger, not silently hide a stray row. A voided invoice is excluded outright: it's neither
    // collected, pending nor overdue -- it no longer represents money owed at all.
    const fees = feeRows.filter(
      (fee) => fee.status !== "VOID" && inRange(fee.dueDate) && (!portalFilter || portalOf(fee.studentId) === portalFilter)
    );
    const expenses = expenseRows.filter((expense) => inRange(expense.date) && (!portalFilter || (expense.portal ?? "Kindervale") === portalFilter));
    const income = incomeRows.filter((entry) => inRange(entry.date) && (!portalFilter || (entry.portal ?? "Daycare") === portalFilter));

    const todayIso = new Date().toISOString().slice(0, 10);
    const toNumber = (value: string | null) => Number(value ?? 0);

    const feesCollected = fees.filter((fee) => fee.status === "PAID").reduce((sum, fee) => sum + toNumber(fee.amount), 0);
    const otherIncome = income.reduce((sum, entry) => sum + toNumber(entry.amount), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
    const totalRevenue = feesCollected + otherIncome;

    const profitAndLoss = {
      feesCollected,
      otherIncome,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses
    };

    const monthBuckets = new Map<string, { month: string; collected: number; pending: number; overdue: number }>();
    for (const fee of fees) {
      const month = fee.dueDate.slice(0, 7);
      const bucket = monthBuckets.get(month) ?? { month, collected: 0, pending: 0, overdue: 0 };
      const amount = toNumber(fee.amount);
      if (fee.status === "PAID") bucket.collected += amount;
      else if (fee.dueDate < todayIso) bucket.overdue += amount;
      else bucket.pending += amount;
      monthBuckets.set(month, bucket);
    }
    const feeCollectionByMonth = [...monthBuckets.values()].sort((a, b) => a.month.localeCompare(b.month));

    const overdue = fees
      .filter((fee) => fee.status !== "PAID" && fee.dueDate < todayIso)
      .map((fee) => {
        const student = studentById.get(fee.studentId);
        const daysOverdue = Math.max(0, Math.round((Date.parse(todayIso) - Date.parse(fee.dueDate)) / 86_400_000));
        return {
          feeId: fee.id,
          invoice: fee.invoice,
          studentId: fee.studentId,
          studentName: student?.name ?? "Unknown",
          admissionNo: student?.admissionNo ?? "",
          className: student?.className ?? "",
          amount: toNumber(fee.amount),
          dueDate: fee.dueDate,
          status: fee.status,
          daysOverdue
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    return { profitAndLoss, feeCollectionByMonth, overdue, generatedAt: new Date().toISOString() };
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

  async createDaycareReport(
    dto: CreateDaycareReportDto,
    createdBy?: string,
    requestingUser?: { userId: string; role: string; portal?: SchoolPortal | null }
  ) {
    await this.assertStudentPortalAccess(requestingUser, dto.studentId, "Student not found");
    return this.insert(daycareReportsTable, { ...dto, createdBy }, "daycare report");
  }

  async getDaycareReports(
    requestingUser?: { userId: string; role: string; portal?: SchoolPortal | null },
    dateRange?: { fromDate?: string; toDate?: string }
  ) {
    const conditions: SQL[] = [];
    if (dateRange?.fromDate) conditions.push(gte(daycareReportsTable.date, dateRange.fromDate));
    if (dateRange?.toDate) conditions.push(lte(daycareReportsTable.date, dateRange.toDate));
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await this.databaseService.db.select().from(daycareReportsTable).where(where);
    return this.scopeRowsToPortal(await this.scopeRowsToParent(rows, requestingUser), requestingUser);
  }

  async getDaycareReport(id: string, requestingUser?: { userId: string; role: string; portal?: SchoolPortal | null }) {
    const report = await this.findOne(daycareReportsTable, id, "Daycare report");
    const [scoped] = await this.scopeRowsToPortal(await this.scopeRowsToParent([report], requestingUser), requestingUser);
    if (!scoped) throw new NotFoundException("Daycare report not found");
    return scoped;
  }

  async updateDaycareReport(
    id: string,
    dto: UpdateDaycareReportDto,
    requestingUser?: { userId: string; role: string; portal?: SchoolPortal | null }
  ) {
    await this.assertExistingRowPortalAccess(daycareReportsTable, id, requestingUser, "Daycare report not found");
    return this.update(daycareReportsTable, id, dto, "Daycare report");
  }

  async deleteDaycareReport(id: string, requestingUser?: { userId: string; role: string; portal?: SchoolPortal | null }) {
    await this.assertExistingRowPortalAccess(daycareReportsTable, id, requestingUser, "Daycare report not found");
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
  async createWeeklyObjective(dto: CreateWeeklyObjectiveDto, teacherId: string, requestingUser?: HomeroomCaller) {
    // Decision 7: a teacher may only post a weekly objective for their own homeroom class.
    assertHomeroomForCreate(requestingUser, dto.className);
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

  getWeeklyObjectives(requestingUser?: HomeroomCaller) {
    // Decision 7: a teacher sees only their own homeroom class's objectives, not every class's.
    const homeroomCondition = homeroomFilterCondition(weeklyObjectivesTable.className, requestingUser);
    const query = this.databaseService.db
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
    return homeroomCondition ? query.where(homeroomCondition) : query;
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

  /** Tokens carry the lowercase portal role ("parent", "daycare_admin", ...); normalize once. */
  private normalizeRole(role?: string): string {
    return (role ?? "").trim().toUpperCase().replace(/[\s-]+/g, "");
  }

  /** Every student id linked to a parent user, or [] if they have no parent record or no children. */
  private async resolveParentStudentIds(userId: string): Promise<string[]> {
    const [parent] = await this.databaseService.db
      .select({ id: parentsTable.id })
      .from(parentsTable)
      .where(eq(parentsTable.userId, userId))
      .limit(1);
    if (!parent) return [];

    const rows = await this.databaseService.db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.parentId, parent.id));
    return rows.map((row) => row.id);
  }

  /**
   * Filters an already-fetched list of rows to a parent's own children, by whichever field
   * carries the student id on that table. Filtering in application code (rather than pushing a
   * WHERE clause into each call site) keeps this identical across fees/report-cards/daycare-
   * reports/etc., and these tables are small enough that the extra round trip doesn't matter.
   * A parent with no linked student sees nothing, never the unfiltered table.
   */
  private async scopeRowsToParent<T extends Record<string, unknown>>(
    rows: T[],
    requestingUser: { userId: string; role: string } | undefined,
    studentIdField: keyof T = "studentId" as keyof T
  ): Promise<T[]> {
    if (this.normalizeRole(requestingUser?.role) !== "PARENT") return rows;
    const studentIds = new Set(await this.resolveParentStudentIds(requestingUser!.userId));
    return rows.filter((row) => studentIds.has(row[studentIdField] as string));
  }

  /**
   * Decision 7: drops rows outside a teacher's own homeroom class. No-op for every other role.
   * Only usable on tables that carry className directly (report cards, weekly objectives, ...) --
   * no join needed, unlike the student-keyed tables scopeRowsToPortal handles.
   */
  private scopeRowsToHomeroom<T extends Record<string, unknown>>(
    rows: T[],
    requestingUser: HomeroomCaller,
    classNameField: keyof T = "className" as keyof T
  ): T[] {
    if (this.normalizeRole(requestingUser?.role) !== "TEACHER") return rows;
    const homeroom = requestingUser?.homeroomClassName;
    if (!homeroom) return [];
    return rows.filter((row) => row[classNameField] === homeroom);
  }

  /**
   * Read-side counterpart of assertStudentPortalAccess: drops rows whose student belongs to the
   * other portal. Rows with no resolvable student are dropped too -- for a confined caller,
   * "can't prove it's mine" has to mean "not shown". No-op for callers with no portal.
   */
  private async scopeRowsToPortal<T extends Record<string, unknown>>(
    rows: T[],
    requestingUser: { userId: string; role: string; portal?: SchoolPortal | null } | undefined,
    studentIdField: keyof T = "studentId" as keyof T
  ): Promise<T[]> {
    const required = callerPortal(requestingUser);
    if (!required || !rows.length) return rows;
    const studentIds: string[] = [
      ...new Set(
        rows.flatMap((row) => {
          const id = row[studentIdField];
          return typeof id === "string" ? [id as string] : [];
        })
      )
    ];
    const students = studentIds.length
      ? await this.databaseService.db
          .select({ id: studentsTable.id, className: studentsTable.className })
          .from(studentsTable)
          .where(inArray(studentsTable.id, studentIds))
      : [];
    const portalByStudent = new Map(students.map((student) => [student.id, classNameToPortal(student.className)]));
    return rows.filter((row) => portalByStudent.get(row[studentIdField] as string) === required);
  }

  /**
   * For write paths keyed by studentId (fees, daycare reports): confirms the referenced student
   * belongs to the caller's own portal before the write happens. Same gap as students/teachers
   * themselves -- a Daycare Admin's token had no server-side reason it couldn't create or edit a
   * fee or daycare report against a Kindervale child, only ever the frontend choosing not to
   * offer one. No-ops for roles with no portal (PRINCIPAL, PARENT -- the latter never reaches
   * these write endpoints at all, gated by permission).
   */
  private async assertStudentPortalAccess(
    requestingUser: { userId: string; role: string; portal?: SchoolPortal | null } | undefined,
    studentId: string | undefined,
    notFoundMessage: string
  ): Promise<void> {
    if (!callerPortal(requestingUser) || !studentId) return;
    const [student] = await this.databaseService.db
      .select({ className: studentsTable.className })
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId))
      .limit(1);
    assertPortalAccess(requestingUser, student?.className, notFoundMessage);
  }

  /** Same check as assertStudentPortalAccess, but for update/delete where only the row's own
   * id is known -- looks up its studentId first. Works for any table with a studentId column
   * (fees, daycare reports). */
  private async assertExistingRowPortalAccess(
    table: any,
    id: string,
    requestingUser: { userId: string; role: string; portal?: SchoolPortal | null } | undefined,
    notFoundMessage: string
  ): Promise<void> {
    if (!callerPortal(requestingUser)) return;
    const [row] = await this.databaseService.db.select({ studentId: table.studentId }).from(table).where(eq(table.id, id)).limit(1);
    if (!row) throw new NotFoundException(notFoundMessage);
    await this.assertStudentPortalAccess(requestingUser, row.studentId as string, notFoundMessage);
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

  // ── Staff Attendance ─────────────────────────────────────────
  async getStaffAttendance(
    query: { date?: string; teacherId?: string; fromDate?: string; toDate?: string },
    requestingUser?: { userId: string; role: string }
  ) {
    const conditions: SQL[] = [];
    if (query.teacherId) conditions.push(eq(staffAttendanceTable.teacherId, query.teacherId));
    if (query.date) conditions.push(eq(staffAttendanceTable.date, query.date));
    if (query.fromDate) conditions.push(gte(staffAttendanceTable.date, query.fromDate));
    if (query.toDate) conditions.push(lte(staffAttendanceTable.date, query.toDate));
    const where = conditions.length ? and(...conditions) : undefined;

    const items = await this.databaseService.db
      .select({
        id: staffAttendanceTable.id,
        teacherId: staffAttendanceTable.teacherId,
        date: staffAttendanceTable.date,
        status: staffAttendanceTable.status,
        arrivalTime: staffAttendanceTable.arrivalTime,
        departureTime: staffAttendanceTable.departureTime,
        remarks: staffAttendanceTable.remarks,
        markedBy: staffAttendanceTable.markedBy,
        submitted: staffAttendanceTable.submitted,
        createdAt: staffAttendanceTable.createdAt,
        updatedAt: staffAttendanceTable.updatedAt,
        teacherClassName: teachersTable.className
      })
      .from(staffAttendanceTable)
      .leftJoin(teachersTable, eq(staffAttendanceTable.teacherId, teachersTable.id))
      .where(where)
      .orderBy(desc(staffAttendanceTable.date));

    const required = callerPortal(requestingUser?.role);
    const scoped = required ? items.filter((row) => classNameToPortal(row.teacherClassName) === required) : items;
    return { items: scoped.map(({ teacherClassName, ...row }) => row) };
  }

  async bulkMarkStaffAttendance(
    dto: {
      date: string;
      records: { teacherId: string; status: string; arrivalTime?: string; departureTime?: string; remarks?: string }[];
    },
    markedBy?: string,
    requestingUser?: { userId: string; role: string }
  ) {
    const date = dto.date.slice(0, 10);
    const required = callerPortal(requestingUser?.role);

    // Confirm every teacherId in the batch belongs to the caller's own portal before writing
    // any of it -- a Daycare Admin's token had nothing stopping it marking a Kindervale
    // teacher's attendance (or vice versa), same gap as everywhere else in this pass.
    if (required) {
      const teacherIds = [...new Set(dto.records.map((rec) => rec.teacherId))];
      const rows = teacherIds.length
        ? await this.databaseService.db
            .select({ id: teachersTable.id, className: teachersTable.className })
            .from(teachersTable)
            .where(inArray(teachersTable.id, teacherIds))
        : [];
      const classNameById = new Map(rows.map((row) => [row.id, row.className]));
      for (const teacherId of teacherIds) {
        assertPortalAccess(requestingUser?.role, classNameById.get(teacherId), "Teacher not found");
      }
    }

    const results: any[] = [];

    for (const rec of dto.records) {
      // Only PRESENT/LATE carry a real arrival/departure; ABSENT/ON_LEAVE never do, regardless
      // of what the client sent.
      const hasTimes = rec.status === "PRESENT" || rec.status === "LATE";
      const arrivalTime = hasTimes ? rec.arrivalTime : null;
      const departureTime = hasTimes ? rec.departureTime : null;

      const [existing] = await this.databaseService.db
        .select({ id: staffAttendanceTable.id })
        .from(staffAttendanceTable)
        .where(and(eq(staffAttendanceTable.teacherId, rec.teacherId), eq(staffAttendanceTable.date, date)))
        .limit(1);

      if (existing) {
        const [updated] = await this.databaseService.db
          .update(staffAttendanceTable)
          .set({ status: rec.status as any, arrivalTime, departureTime, remarks: rec.remarks, markedBy, updatedAt: new Date() })
          .where(eq(staffAttendanceTable.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await this.databaseService.db
          .insert(staffAttendanceTable)
          .values({ teacherId: rec.teacherId, date, status: rec.status as any, arrivalTime, departureTime, remarks: rec.remarks, markedBy })
          .returning();
        results.push(created);
      }
    }
    return results;
  }

  /** Finalizes a day's staff attendance -- flips every row for that date, within the caller's
   * portal, from draft to submitted. Rows stay editable afterward; this only affects the
   * draft/submitted badge shown in the UI. */
  async submitStaffAttendance(date: string, requestingUser?: { userId: string; role: string }): Promise<void> {
    const normalizedDate = date.slice(0, 10);
    const required = callerPortal(requestingUser?.role);

    if (!required) {
      await this.databaseService.db
        .update(staffAttendanceTable)
        .set({ submitted: true, updatedAt: new Date() })
        .where(eq(staffAttendanceTable.date, normalizedDate));
      return;
    }

    const rows = await this.databaseService.db
      .select({ id: staffAttendanceTable.id, className: teachersTable.className })
      .from(staffAttendanceTable)
      .leftJoin(teachersTable, eq(staffAttendanceTable.teacherId, teachersTable.id))
      .where(eq(staffAttendanceTable.date, normalizedDate));

    const idsInPortal = rows.filter((row) => classNameToPortal(row.className) === required).map((row) => row.id);
    if (!idsInPortal.length) return;

    await this.databaseService.db
      .update(staffAttendanceTable)
      .set({ submitted: true, updatedAt: new Date() })
      .where(inArray(staffAttendanceTable.id, idsInPortal));
  }

}
