import cuid from "common/cuid";
import { boolean, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "DAYCAREADMIN", "PRINCIPAL", "TEACHER", "PARENT", "ACCOUNTANT"]);
export type UserRole = (typeof userRoleEnum.enumValues)[number];

// ARCHIVED is a soft-deleted account: login is refused (same as INACTIVE) but, unlike a hard
// delete, none of the person's history (attendance, fees, homework, ...) is removed with them.
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE", "ARCHIVED"]);
export type UserStatus = (typeof userStatusEnum.enumValues)[number];

const usersTable = pgTable("users", {
  id: cuid().primaryKey(),
  name: text().notNull(),
  username: text().notNull().unique(),
  email: text().notNull().unique(),
  password: text().notNull(),
  role: userRoleEnum().notNull(),
  status: userStatusEnum().default("ACTIVE").notNull(),
  // True right after an Admin sets/resets a password for someone else, so the next successful
  // login can force a change before the person does anything else with a password only staff
  // has seen.
  mustChangePassword: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export default usersTable;
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type SafeUser = Omit<User, "password">;
