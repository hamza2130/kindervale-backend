import cuid from "common/cuid";
import usersTable from "models/users";
import teachersTable, { teacherAttendanceEnum } from "models/teachers";
import { boolean, date, integer, jsonb, numeric, pgEnum, pgTable, text, time, timestamp, unique } from "drizzle-orm/pg-core";

// VOID: an issued invoice cancelled/corrected by the Accountant (decision 4's "void/credit-note
// capability") -- the row stays, same as every other archive-instead-of-delete pattern in this
// codebase, so a corrected invoice's history is never silently erased. Shared with
// studentsTable.feeStatus below; nothing ever actually sets a student's own status to VOID, that
// value is only ever used on a fee row.
export const feeStatusEnum = pgEnum("fee_status", ["PAID", "PENDING", "PARTIAL", "VOID"]);
export type FeeStatus = (typeof feeStatusEnum.enumValues)[number];

export const notificationAudienceEnum = pgEnum("notification_audience", [
  "ALL",
  "ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "PARENT",
  "STUDENT"
]);
export type NotificationAudience = (typeof notificationAudienceEnum.enumValues)[number];

export const studentAttendanceStatusEnum = pgEnum("student_attendance_status", ["PRESENT", "LATE", "ABSENT", "EXCUSED"]);
export type StudentAttendanceStatus = (typeof studentAttendanceStatusEnum.enumValues)[number];

export const lessonPlanStatusEnum = pgEnum("lesson_plan_status", ["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export type LessonPlanStatus = (typeof lessonPlanStatusEnum.enumValues)[number];

export const reviewStatusEnum = pgEnum("review_status", ["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export type ReviewStatus = (typeof reviewStatusEnum.enumValues)[number];

// Decouples which label set a report card renders with (see common/report-template.ts) from the
// free-text `term` display string ("January 2026") -- a report is either a midterm Progress Check
// or a Final/End-of-Year Report, and a handful of section labels differ between the two.
export const reportTypeEnum = pgEnum("report_type", ["MIDTERM", "FINAL"]);
export type ReportType = (typeof reportTypeEnum.enumValues)[number];

export const documentTypeEnum = pgEnum("document_type", ["DOCUMENT", "PHOTO", "REPORT_CARD", "POLICY"]);
export type DocumentType = (typeof documentTypeEnum.enumValues)[number];

export const leaveStatusEnum = pgEnum("leave_status", ["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);
export type LeaveStatus = (typeof leaveStatusEnum.enumValues)[number];

export const parentsTable = pgTable("parents", {
  id: cuid().primaryKey(),
  userId: text()
    .unique()
    .references(() => usersTable.id, { onDelete: "set null" }),
  name: text().notNull(),
  email: text().notNull().unique(),
  phone: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const studentsTable = pgTable("students", {
  id: cuid().primaryKey(),
  admissionNo: text().notNull().unique(),
  userId: text()
    .unique()
    .references(() => usersTable.id, { onDelete: "set null" }),
  parentId: text().references(() => parentsTable.id, { onDelete: "set null" }),
  name: text().notNull(),
  className: text().notNull(),
  section: text(),
  age: integer().notNull(),
  birthday: date(),
  attendance: integer().default(0).notNull(),
  phone: text(),
  bloodGroup: text(),
  address: text(),
  emergencyContactName: text(),
  emergencyContactPhone: text(),
  photoUrl: text(),
  feeStatus: feeStatusEnum().default("PENDING").notNull(),
  // Set when a withdrawn/left student is archived (see StudentService.deleteStudent): their row
  // and every table that references studentId (attendance, fees, homework, report cards, ...)
  // stay untouched -- only this timestamp is set, and their login (if they had one) is revoked.
  archivedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const classesTable = pgTable("classes", {
  id: cuid().primaryKey(),
  name: text().notNull().unique(),
  teacher: text().notNull(),
  homeroomTeacherId: text().references(() => usersTable.id, { onDelete: "set null" }),
  academicYear: text(),
  capacity: integer().notNull(),
  // Which portal this class belongs to. Existing seeded/default classes are matched against the
  // hardcoded DAYCARE_CLASS_NAMES list in common/portal-scope.ts when this is unset, so backfill
  // isn't required -- only classes created after this field existed rely on it being set directly.
  portal: text().default("Kindervale").notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const sectionsTable = pgTable("sections", {
  id: cuid().primaryKey(),
  classId: text()
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  name: text().notNull(),
  capacity: integer(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const subjectsTable = pgTable("subjects", {
  id: cuid().primaryKey(),
  name: text().notNull().unique(),
  code: text().unique(),
  description: text(),
  classId: text().references(() => classesTable.id, { onDelete: "set null" }),
  teacherId: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const attendanceTable = pgTable("attendance", {
  id: cuid().primaryKey(),
  studentId: text()
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  classId: text().references(() => classesTable.id, { onDelete: "set null" }),
  date: date().notNull(),
  status: studentAttendanceStatusEnum().notNull(),
  remarks: text(),
  markedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const feesTable = pgTable("fees", {
  id: cuid().primaryKey(),
  invoice: text().notNull().unique(),
  studentId: text()
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  scholarship: integer().default(0).notNull(),
  dueDate: date().notNull(),
  // "Submission date" -- when the Accountant actually sent this challan to the family. Set once,
  // automatically, at creation (this system generates and sends an invoice in one step; there is
  // no separate draft/send flow), never client-supplied, so it can't be backdated.
  issuedAt: timestamp().defaultNow().notNull(),
  status: feeStatusEnum().default("PENDING").notNull(),
  // Set together when an Accountant voids a wrongly-issued or corrected invoice.
  voidedAt: timestamp(),
  voidReason: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

/**
 * The default monthly fee for a class, used to actually generate invoices instead of the flat
 * hardcoded amount every student used to get regardless of which class they're in. Daycare is
 * never billed per child (decision 3), so a structure only ever makes sense for a Kindervale
 * class in practice -- nothing here enforces that at the schema level, since the invoice-
 * generation flow already only ever targets Kindervale students.
 */
export const feeStructuresTable = pgTable("fee_structures", {
  id: cuid().primaryKey(),
  className: text().notNull().unique(),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const examsTable = pgTable("exams", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  subject: text().notNull(),
  className: text().notNull(),
  date: date().notNull(),
  maxMarks: integer().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const reportCardsTable = pgTable("report_cards", {
  id: cuid().primaryKey(),
  studentId: text()
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  term: text().notNull(),
  reportType: reportTypeEnum().default("MIDTERM").notNull(),
  className: text().notNull(),
  academicYear: text().notNull(),
  summary: text(),
  fileUrl: text(),
  status: reviewStatusEnum().default("DRAFT").notNull(),
  publishedAt: timestamp(),
  createdBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const homeworkTable = pgTable("homework", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  description: text(),
  classId: text().references(() => classesTable.id, { onDelete: "set null" }),
  subjectId: text().references(() => subjectsTable.id, { onDelete: "set null" }),
  teacherId: text().references(() => usersTable.id, { onDelete: "set null" }),
  className: text().notNull(),
  subject: text().notNull(),
  dueDate: date().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const lessonPlansTable = pgTable("lesson_plans", {
  id: cuid().primaryKey(),
  teacherId: text()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  classId: text()
    .notNull()
    .references(() => classesTable.id, { onDelete: "cascade" }),
  subjectId: text().references(() => subjectsTable.id, { onDelete: "set null" }),
  subject: text().notNull(),
  weekStartDate: date().notNull(),
  objectives: text().notNull(),
  activities: text().notNull(),
  resources: text(),
  status: lessonPlanStatusEnum().default("DRAFT").notNull(),
  reviewRemarks: text(),
  reviewedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const calendarEventsTable = pgTable("calendar_events", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  date: date().notNull(),
  type: text().notNull(),
  // "Kindervale" | "Daycare" | "Both" -- defaults to "Both" so every existing row (and anything
  // inserted before this column existed) keeps showing to everyone, matching today's behavior.
  portal: text().notNull().default("Both"),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const timetablesTable = pgTable("timetables", {
  id: cuid().primaryKey(),
  classId: text().references(() => classesTable.id, { onDelete: "cascade" }),
  className: text().notNull(),
  dayOfWeek: text().notNull(),
  startTime: text().notNull(),
  endTime: text().notNull(),
  subject: text().notNull(),
  teacherId: text().references(() => usersTable.id, { onDelete: "set null" }),
  room: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const documentsTable = pgTable("documents", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  description: text(),
  type: documentTypeEnum().default("DOCUMENT").notNull(),
  fileUrl: text().notNull(),
  audience: notificationAudienceEnum().default("ALL").notNull(),
  studentId: text().references(() => studentsTable.id, { onDelete: "cascade" }),
  uploadedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const leaveRequestsTable = pgTable("leave_requests", {
  id: cuid().primaryKey(),
  userId: text()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  studentId: text().references(() => studentsTable.id, { onDelete: "cascade" }),
  type: text(),
  addedBy: text(),
  fromDate: date().notNull(),
  toDate: date().notNull(),
  reason: text().notNull(),
  status: leaveStatusEnum().default("PENDING").notNull(),
  reviewRemarks: text(),
  reviewedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const expensesTable = pgTable("expenses", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  category: text().notNull(),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  date: date().notNull(),
  notes: text(),
  // Had no way to tell a Daycare expense from a Kindervale one at all -- the frontend hardcoded
  // "Kindervale" on every row it displayed, which silently hid every expense from Daycare Admin
  // (their view filters to portal === "Daycare", so it always matched zero rows). Defaults to
  // "Kindervale" so existing untagged rows keep showing where they already did.
  portal: text().default("Kindervale").notNull(),
  createdBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  // Set only on rows the monthly payroll job creates automatically (models/school.ts's
  // staffAttendanceTable-adjacent teacher.salary -> here). Used purely to check "has this
  // teacher's salary already been expensed for this month" before inserting -- never read for
  // display. Both null on every manually-entered expense.
  payrollTeacherId: text().references(() => usersTable.id, { onDelete: "set null" }),
  payrollPeriod: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

/**
 * Money received, recorded as a ledger entry rather than an invoice.
 *
 * Daycare is not billed per child — a single lump sum arrives every two months covering
 * everyone, and it is entered by hand. The fees table cannot hold that: `studentId` is
 * required there and every row is a unique invoice, so a pooled payment has no child to
 * attach to. This is the counterpart to `expenses` — same shape, opposite direction — which
 * keeps "money in" and "money out" symmetrical and reportable over the same date ranges.
 *
 * `periodStart`/`periodEnd` describe what the payment covers (e.g. Sep–Oct), which is not
 * necessarily the day it landed (`date`).
 */
export const incomeTable = pgTable("income", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  category: text().default("Fee Collection").notNull(),
  amount: numeric({ precision: 10, scale: 2 }).notNull(),
  /** Date the money was received. */
  date: date().notNull(),
  /** Inclusive range the payment covers; both null for one-off receipts. */
  periodStart: date(),
  periodEnd: date(),
  /** "Kindervale" or "Daycare" — keeps the two portals' finances separate. */
  portal: text().default("Daycare").notNull(),
  notes: text(),
  createdBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const faqsTable = pgTable("faqs", {
  id: cuid().primaryKey(),
  question: text().notNull(),
  answer: text().notNull(),
  audience: notificationAudienceEnum().default("ALL").notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const schoolPoliciesTable = pgTable("school_policies", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  content: text().notNull(),
  fileUrl: text(),
  audience: notificationAudienceEnum().default("ALL").notNull(),
  publishedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const daycareReportsTable = pgTable("daycare_reports", {
  id: cuid().primaryKey(),
  studentId: text()
    .notNull()
    .references(() => studentsTable.id, { onDelete: "cascade" }),
  date: date().notNull(),
  meals: text(),
  nap: text(),
  activities: text(),
  notes: text(),
  // The daily report and the daycare care log are two views of the same day, so both sets of
  // fields live on one row rather than in two near-identical tables.
  mood: text(),
  arrival: text(),
  snack: text(),
  departure: text(),
  // Structured sections from the paper "Child's Daily Report" form that don't map to a single
  // flat column: meals (breakfast/snack/lunch, each with time/food/quantity), drinks, naps,
  // diaper changes, and the items-needed checklist. `meals`/`nap`/`snack` above are legacy
  // free-text columns kept only so older rows still read back; new rows write here instead.
  details: jsonb(),
  createdBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

/** One row per student per homework item; the presence of a row means "handed in". */
export const homeworkSubmissionsTable = pgTable(
  "homework_submissions",
  {
    id: cuid().primaryKey(),
    homeworkId: text()
      .notNull()
      .references(() => homeworkTable.id, { onDelete: "cascade" }),
    studentId: text()
      .notNull()
      .references(() => studentsTable.id, { onDelete: "cascade" }),
    note: text(),
    submittedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
    submittedAt: timestamp().defaultNow().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull()
  },
  (table) => [unique("homework_submissions_homework_student_unique").on(table.homeworkId, table.studentId)]
);

/** Read state is per person, so it cannot live as a flag on the notification itself. */
export const notificationReadsTable = pgTable(
  "notification_reads",
  {
    id: cuid().primaryKey(),
    notificationId: text()
      .notNull()
      .references(() => notificationsTable.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    readAt: timestamp().defaultNow().notNull()
  },
  (table) => [unique("notification_reads_notification_user_unique").on(table.notificationId, table.userId)]
);

/** A teacher's weekly objectives for their class, approved by Admin before parents see them. */
export const weeklyObjectivesTable = pgTable("weekly_objectives", {
  id: cuid().primaryKey(),
  teacherId: text()
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  classId: text().references(() => classesTable.id, { onDelete: "set null" }),
  className: text().notNull(),
  week: text().notNull(),
  message: text().notNull(),
  status: reviewStatusEnum().default("PENDING").notNull(),
  reviewRemarks: text(),
  reviewedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const daycareResourcesTable = pgTable("daycare_resources", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  description: text(),
  fileUrl: text(),
  createdBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const backupsTable = pgTable("backups", {
  id: cuid().primaryKey(),
  type: text().notNull(),
  status: text().default("REQUESTED").notNull(),
  fileUrl: text(),
  requestedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const notificationsTable = pgTable("notifications", {
  id: cuid().primaryKey(),
  title: text().notNull(),
  body: text().notNull(),
  date: date().notNull(),
  audience: notificationAudienceEnum().default("ALL").notNull(),
  // Same "Kindervale" | "Daycare" | "Both" convention as calendarEventsTable.portal -- a separate
  // axis from audience (which is role, not portal). Defaults to "Both" for the same reason.
  portal: text().notNull().default("Both"),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const settingsTable = pgTable("settings", {
  id: cuid().primaryKey(),
  schoolName: text().notNull(),
  academicYear: text().notNull(),
  timezone: text().notNull(),
  // Array of { start, end } (ISO dates), one per TERMS label on the frontend. Editing this in
  // Settings used to only update an in-memory variable in the legacy script -- real on screen,
  // gone on the next reload, with nowhere in the schema to actually persist it.
  termDates: jsonb(),
  contactEmail: text(),
  contactPhone: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export type Parent = typeof parentsTable.$inferSelect;
export type Student = typeof studentsTable.$inferSelect;
export type ClassRoom = typeof classesTable.$inferSelect;
export type Section = typeof sectionsTable.$inferSelect;
export type Subject = typeof subjectsTable.$inferSelect;
// Staff/Teacher daily attendance records
export const staffAttendanceTable = pgTable("staff_attendance", {
  id: cuid().primaryKey(),
  teacherId: text()
    .notNull()
    .references(() => teachersTable.id, { onDelete: "cascade" }),
  date: date().notNull(),
  status: teacherAttendanceEnum().notNull().default("PRESENT"),
  // Only meaningful for PRESENT/LATE; left null for ABSENT/ON_LEAVE.
  arrivalTime: time(),
  departureTime: time(),
  remarks: text(),
  markedBy: text().references(() => usersTable.id, { onDelete: "set null" }),
  // A day's rows start as drafts as they're marked one by one; POST /staff-attendance/submit
  // flips every row for that date (within the caller's portal) to true. Rows stay editable
  // afterward -- this is a visibility flag for the principal's view, not a lock.
  submitted: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export type StaffAttendance = typeof staffAttendanceTable.$inferSelect;

export type Attendance = typeof attendanceTable.$inferSelect;
export type Fee = typeof feesTable.$inferSelect;
export type FeeStructure = typeof feeStructuresTable.$inferSelect;
export type Exam = typeof examsTable.$inferSelect;
export type ReportCard = typeof reportCardsTable.$inferSelect;
export type Homework = typeof homeworkTable.$inferSelect;
export type LessonPlan = typeof lessonPlansTable.$inferSelect;
export type CalendarEvent = typeof calendarEventsTable.$inferSelect;
export type Timetable = typeof timetablesTable.$inferSelect;
export type Document = typeof documentsTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
export type Faq = typeof faqsTable.$inferSelect;
export type SchoolPolicy = typeof schoolPoliciesTable.$inferSelect;
export type DaycareReport = typeof daycareReportsTable.$inferSelect;
export type HomeworkSubmission = typeof homeworkSubmissionsTable.$inferSelect;
export type NotificationRead = typeof notificationReadsTable.$inferSelect;
export type WeeklyObjective = typeof weeklyObjectivesTable.$inferSelect;
export type DaycareResource = typeof daycareResourcesTable.$inferSelect;
export type Backup = typeof backupsTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type Settings = typeof settingsTable.$inferSelect;
