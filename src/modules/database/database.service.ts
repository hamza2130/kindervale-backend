import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";

@Injectable()
export class DatabaseService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;
  public db: ReturnType<typeof drizzle>;

  // Resolves once schema migrations have finished. Seeder services await this
  // so seeding can never run against a pre-migration schema.
  private migrationsDone!: Promise<void>;
  private resolveMigrations!: () => void;

  constructor(private readonly configService: ConfigService) {
    // Connect in the constructor so `this.db` is guaranteed ready before any
    // other service's onApplicationBootstrap (permission/class seeding) runs.
    const connectionString: string = this.configService.getOrThrow<string>("DATABASE_URL");
    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { casing: "snake_case" });
    this.migrationsDone = new Promise<void>((resolve) => {
      this.resolveMigrations = resolve;
    });
  }

  /** Seeder services await this before inserting default data. */
  whenReady(): Promise<void> {
    return this.migrationsDone;
  }

  async onApplicationBootstrap() {
    // A transient connection failure here (a Neon cold-start hiccup right after a free-tier
    // suspension lifts is the known trigger -- see RoleService's identical retry) used to be
    // silently swallowed by runMigrations()'s own catch, leaving whichever statements hadn't run
    // yet missing until the next restart. Every statement is additive (IF NOT EXISTS/ADD VALUE IF
    // NOT EXISTS) so a partial run is self-healing, not a regression -- unlike permission
    // reconciliation, there's no delete-then-fail-to-reinsert risk here, so this only needs the
    // retry, not a transaction wrap (ALTER TYPE ... ADD VALUE also can't be combined with using
    // that new value in the same transaction, and Neon's pooler can be fussy about multi-statement
    // DDL transactions -- wrapping ~30 statements in one would trade this failure mode for a
    // different one).
    const attempts = 3;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const ok = await this.runMigrations();
      if (ok) break;
      if (attempt === attempts) {
        this.logger.error(`Migrations failed after ${attempts} attempts -- app is starting with a possibly incomplete schema`);
      } else {
        this.logger.warn(`Migration attempt ${attempt}/${attempts} failed, retrying`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    this.resolveMigrations();
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  /**
   * Idempotent, self-healing schema migration. Every statement uses
   * IF NOT EXISTS so it is safe to run on every startup. This applies the
   * columns/tables from scripts/migrations/20260821_add_engagement_tables.sql
   * without needing shell access to the Render database.
   */
  private async runMigrations(): Promise<boolean> {
    try {
      await this.db.execute(sql`
        ALTER TABLE "teachers"
          ADD COLUMN IF NOT EXISTS "qualifications" text,
          ADD COLUMN IF NOT EXISTS "bio" text
      `);

      await this.db.execute(sql`
        ALTER TABLE "daycare_reports"
          ADD COLUMN IF NOT EXISTS "mood" text,
          ADD COLUMN IF NOT EXISTS "arrival" text,
          ADD COLUMN IF NOT EXISTS "snack" text,
          ADD COLUMN IF NOT EXISTS "departure" text,
          ADD COLUMN IF NOT EXISTS "details" jsonb
      `);

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "homework_submissions" (
          "id" text PRIMARY KEY NOT NULL,
          "homework_id" text NOT NULL REFERENCES "homework"("id") ON DELETE CASCADE,
          "student_id" text NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
          "note" text,
          "submitted_by" text REFERENCES "users"("id") ON DELETE SET NULL,
          "submitted_at" timestamp DEFAULT now() NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "homework_submissions_homework_student_unique" UNIQUE ("homework_id", "student_id")
        )
      `);

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "notification_reads" (
          "id" text PRIMARY KEY NOT NULL,
          "notification_id" text NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
          "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "read_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "notification_reads_notification_user_unique" UNIQUE ("notification_id", "user_id")
        )
      `);

      await this.db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_status') THEN
            CREATE TYPE "review_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
          END IF;
        END $$
      `);

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "weekly_objectives" (
          "id" text PRIMARY KEY NOT NULL,
          "teacher_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "class_id" text REFERENCES "classes"("id") ON DELETE SET NULL,
          "class_name" text NOT NULL,
          "week" text NOT NULL,
          "message" text NOT NULL,
          "status" "review_status" DEFAULT 'PENDING' NOT NULL,
          "review_remarks" text,
          "reviewed_by" text REFERENCES "users"("id") ON DELETE SET NULL,
          "reviewed_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "staff_attendance" (
          "id" text PRIMARY KEY NOT NULL,
          "teacher_id" text NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
          "date" date NOT NULL,
          "status" "teacher_attendance" NOT NULL DEFAULT 'PRESENT',
          "remarks" text,
          "marked_by" text REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "staff_attendance_teacher_date_unique" UNIQUE ("teacher_id", "date")
        )
      `);

      // Money received, recorded as a ledger entry rather than an invoice. Daycare is not
      // billed per child -- one lump sum arrives every two months covering everyone -- and
      // the fees table cannot hold that, since student_id is required there and every row is
      // a unique invoice. This is the counterpart to "expenses": same shape, opposite
      // direction. Mirrors scripts/migrations/20260912_add_income_ledger.sql.
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "income" (
          "id" text PRIMARY KEY NOT NULL,
          "title" text NOT NULL,
          "category" text NOT NULL DEFAULT 'Fee Collection',
          "amount" numeric(10, 2) NOT NULL,
          "date" date NOT NULL,
          "period_start" date,
          "period_end" date,
          "portal" text NOT NULL DEFAULT 'Daycare',
          "notes" text,
          "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);

      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS "income_portal_date_idx" ON "income" ("portal", "date")
      `);

      // expenses had no way to tell a Daycare expense from a Kindervale one -- the frontend
      // hardcoded "Kindervale" on every row it displayed, which silently hid every expense from
      // Daycare Admin's view (filtered to portal === "Daycare", so it always matched nothing).
      // Defaults existing rows to "Kindervale" so they keep showing exactly where they already did.
      await this.db.execute(sql`
        ALTER TABLE "expenses"
          ADD COLUMN IF NOT EXISTS "portal" text NOT NULL DEFAULT 'Kindervale'
      `);

      // Accountant role + homeroom teachers + payroll automation + classes/sections portal
      // tagging + student sections + staff-attendance times/submit (see models/users.ts,
      // teachers.ts, school.ts). Enum values can't use IF NOT EXISTS-on-the-type -- ADD VALUE
      // IF NOT EXISTS is the idempotent form Postgres actually supports for this.
      await this.db.execute(sql`ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'ACCOUNTANT'`);
      await this.db.execute(sql`ALTER TYPE "teacher_attendance" ADD VALUE IF NOT EXISTS 'ON_LEAVE'`);

      await this.db.execute(sql`
        ALTER TABLE "teachers"
          ADD COLUMN IF NOT EXISTS "salary" numeric(10, 2)
      `);

      await this.db.execute(sql`
        ALTER TABLE "classes"
          ADD COLUMN IF NOT EXISTS "portal" text NOT NULL DEFAULT 'Kindervale'
      `);

      await this.db.execute(sql`
        ALTER TABLE "students"
          ADD COLUMN IF NOT EXISTS "section" text
      `);

      await this.db.execute(sql`
        ALTER TABLE "staff_attendance"
          ADD COLUMN IF NOT EXISTS "arrival_time" time,
          ADD COLUMN IF NOT EXISTS "departure_time" time,
          ADD COLUMN IF NOT EXISTS "submitted" boolean NOT NULL DEFAULT false
      `);

      await this.db.execute(sql`
        ALTER TABLE "expenses"
          ADD COLUMN IF NOT EXISTS "payroll_teacher_id" text REFERENCES "users"("id") ON DELETE SET NULL,
          ADD COLUMN IF NOT EXISTS "payroll_period" text
      `);

      // Archiving (soft delete keeps history; login is refused same as INACTIVE) + forced
      // password change after an Admin/Accountant sets someone else's password for them.
      await this.db.execute(sql`ALTER TYPE "user_status" ADD VALUE IF NOT EXISTS 'ARCHIVED'`);
      await this.db.execute(sql`
        ALTER TABLE "users"
          ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false
      `);

      // Denormalized soft-delete marker for a departed teacher (see TeacherService.deleteTeacher):
      // the profile/salary/attendance rows stay, only this timestamp + the linked user's status
      // change. Kept on this table (not joined from usersTable) so getTeachers()'s paginated
      // select and its unjoined count() query can both filter on it without a join mismatch.
      await this.db.execute(sql`
        ALTER TABLE "teachers"
          ADD COLUMN IF NOT EXISTS "archived_at" timestamp
      `);

      // Same soft-delete marker, on students (see StudentService.deleteStudent).
      await this.db.execute(sql`
        ALTER TABLE "students"
          ADD COLUMN IF NOT EXISTS "archived_at" timestamp
      `);

      // "Submission date" on an invoice -- when the Accountant actually sent it (decision 3).
      // Existing rows default to now() at migration time, same as their own createdAt would have.
      await this.db.execute(sql`
        ALTER TABLE "fees"
          ADD COLUMN IF NOT EXISTS "issued_at" timestamp NOT NULL DEFAULT now()
      `);

      // Void/credit-note capability (decision 4): a corrected/cancelled invoice is voided, not
      // deleted -- the row and its history stay, same as every other archive-not-delete pattern.
      await this.db.execute(sql`ALTER TYPE "fee_status" ADD VALUE IF NOT EXISTS 'VOID'`);
      await this.db.execute(sql`
        ALTER TABLE "fees"
          ADD COLUMN IF NOT EXISTS "voided_at" timestamp,
          ADD COLUMN IF NOT EXISTS "void_reason" text
      `);

      // Per-class fee structure (decision 4): the default monthly amount to invoice a class,
      // used by bulk invoice generation instead of a flat hardcoded figure for every student.
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "fee_structures" (
          "id" text PRIMARY KEY NOT NULL,
          "class_name" text NOT NULL UNIQUE,
          "amount" numeric(10, 2) NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);

      // ID-card fields: client feedback was that the printed card showed name + a raw dash for
      // everything else. These are optional -- admin fills them in whenever, on either portal.
      await this.db.execute(sql`
        ALTER TABLE "students"
          ADD COLUMN IF NOT EXISTS "blood_group" text,
          ADD COLUMN IF NOT EXISTS "address" text,
          ADD COLUMN IF NOT EXISTS "emergency_contact_name" text,
          ADD COLUMN IF NOT EXISTS "emergency_contact_phone" text
      `);

      // Portal scoping for calendar events/notices: previously neither table had any way to
      // confine an event/notice to one portal, so a Kindervale-only announcement was visible to
      // Daycare too (and vice versa) with no way to prevent it. Default "Both" preserves exactly
      // today's behavior for every existing row.
      await this.db.execute(sql`
        ALTER TABLE "calendar_events"
          ADD COLUMN IF NOT EXISTS "portal" text NOT NULL DEFAULT 'Both'
      `);
      await this.db.execute(sql`
        ALTER TABLE "notifications"
          ADD COLUMN IF NOT EXISTS "portal" text NOT NULL DEFAULT 'Both'
      `);

      // Term dates + school contact info: editing either in Settings used to only update an
      // in-memory variable, gone on the next reload, with no column to actually persist either.
      await this.db.execute(sql`
        ALTER TABLE "settings"
          ADD COLUMN IF NOT EXISTS "term_dates" jsonb,
          ADD COLUMN IF NOT EXISTS "contact_email" text,
          ADD COLUMN IF NOT EXISTS "contact_phone" text
      `);

      // Report-card redesign: a report is either a midterm Progress Check or a Final/End-of-Year
      // Report, and which label set it renders with (see common/report-template.ts) depends on
      // this, not on the free-text `term` display string. photoUrl on students backs the circle
      // photo an End-of-Year report shows (optional -- a student with none gets a plain avatar).
      await this.db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_type') THEN
            CREATE TYPE "report_type" AS ENUM ('MIDTERM', 'FINAL');
          END IF;
        END $$
      `);
      await this.db.execute(sql`
        ALTER TABLE "report_cards"
          ADD COLUMN IF NOT EXISTS "report_type" "report_type" NOT NULL DEFAULT 'MIDTERM'
      `);
      await this.db.execute(sql`
        ALTER TABLE "students"
          ADD COLUMN IF NOT EXISTS "photo_url" text
      `);

      // Partial/recorded payments against a fee (Phase 2 of the fee-structure work): a fee's
      // own status stays a cached summary (PENDING/PARTIAL/PAID), the real history of what was
      // actually collected lives here, one row per installment.
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS "fee_payments" (
          "id" text PRIMARY KEY NOT NULL,
          "fee_id" text NOT NULL REFERENCES "fees"("id") ON DELETE CASCADE,
          "amount" numeric(10, 2) NOT NULL,
          "method" text,
          "note" text,
          "paid_at" timestamp DEFAULT now() NOT NULL,
          "recorded_by" text REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS "fee_payments_fee_id_idx" ON "fee_payments" ("fee_id")
      `);

      this.logger.log("Database migrations applied successfully");
      return true;
    } catch (error) {
      this.logger.warn("Migration attempt failed: " + (error as Error).message);
      return false;
    }
  }
}
