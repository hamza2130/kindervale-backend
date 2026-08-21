import cuid from "common/cuid";
import usersTable from "models/users";
import { date, integer, numeric, pgEnum, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const feeStatusEnum = pgEnum("fee_status", ["PAID", "PENDING", "PARTIAL"]);
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
  age: integer().notNull(),
  birthday: date(),
  attendance: integer().default(0).notNull(),
  phone: text(),
  feeStatus: feeStatusEnum().default("PENDING").notNull(),
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
  status: feeStatusEnum().default("PENDING").notNull(),
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
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export const settingsTable = pgTable("settings", {
  id: cuid().primaryKey(),
  schoolName: text().notNull(),
  academicYear: text().notNull(),
  timezone: text().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export type Parent = typeof parentsTable.$inferSelect;
export type Student = typeof studentsTable.$inferSelect;
export type ClassRoom = typeof classesTable.$inferSelect;
export type Section = typeof sectionsTable.$inferSelect;
export type Subject = typeof subjectsTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type Fee = typeof feesTable.$inferSelect;
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
