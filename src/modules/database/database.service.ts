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
    await this.runMigrations();
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
  private async runMigrations() {
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
          ADD COLUMN IF NOT EXISTS "departure" text
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

      this.logger.log("Database migrations applied successfully");
    } catch (error) {
      this.logger.error("Migration failed: " + (error as Error).message);
    }
  }
}
