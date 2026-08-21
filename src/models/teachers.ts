import cuid from "common/cuid";
import usersTable from "models/users";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const teacherAttendanceEnum = pgEnum("teacher_attendance", ["PRESENT", "LATE", "ABSENT"]);
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
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export default teachersTable;
export type Teacher = typeof teachersTable.$inferSelect;
export type NewTeacher = typeof teachersTable.$inferInsert;
