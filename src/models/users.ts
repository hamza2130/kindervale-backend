import cuid from "common/cuid";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "DAYCAREADMIN", "PRINCIPAL", "TEACHER", "PARENT", "ACCOUNTANT"]);
export type UserRole = (typeof userRoleEnum.enumValues)[number];

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE"]);
export type UserStatus = (typeof userStatusEnum.enumValues)[number];

const usersTable = pgTable("users", {
  id: cuid().primaryKey(),
  name: text().notNull(),
  username: text().notNull().unique(),
  email: text().notNull().unique(),
  password: text().notNull(),
  role: userRoleEnum().notNull(),
  status: userStatusEnum().default("ACTIVE").notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull()
});

export default usersTable;
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type SafeUser = Omit<User, "password">;
