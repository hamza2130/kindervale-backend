import cuid from "common/cuid";
import usersTable from "models/users";
import { numeric, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const teacherAttendanceEnum = pgEnum("teacher_attendance", ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"]);
export type TeacherAttendance = (typeof teacherAttendanceEnum.enumValues)[number];

const teachersTable = pgTable("teachers", {
  id: cuid().primaryKey(),
  userId: text()
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  phone: text(),
  subject: text().notNull(),
  className: text().notNull(),
  qualifications: text(),
  bio: text(),
  attendance: teacherAttendanceEnum().default("PRESENT").notNull(),
  // Monthly salary. Nullable: older teacher rows and any profile created before this field
  // existed have no figure yet, and the payroll job (school.service.ts-adjacent) simply skips
  // a teacher with no salary set rather than treating it as zero.
  salary: numeric({ precision: 10, scale: 2 }),
  // Set when a departed teacher is removed: their record, salary and attendance history stay
  // (nothing here cascades), only their login is revoked (usersTable.status -> ARCHIVED).
  // Denormalized onto this row (rather than joining usersTable) so list/count queries that
  // filter archived teachers out don't need an extra join.
  archivedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export default teachersTable;
export type Teacher = typeof teachersTable.$inferSelect;
export type NewTeacher = typeof teachersTable.$inferInsert;
