-- Persistence for the five portal features that previously only lived in browser memory:
-- homework hand-ins, notification read state, weekly objectives, the daycare care log and
-- the teacher's own profile.

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "qualifications" text,
  ADD COLUMN IF NOT EXISTS "bio" text;

ALTER TABLE "daycare_reports"
  ADD COLUMN IF NOT EXISTS "mood" text,
  ADD COLUMN IF NOT EXISTS "arrival" text,
  ADD COLUMN IF NOT EXISTS "snack" text,
  ADD COLUMN IF NOT EXISTS "departure" text;

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
);

CREATE TABLE IF NOT EXISTS "notification_reads" (
  "id" text PRIMARY KEY NOT NULL,
  "notification_id" text NOT NULL REFERENCES "notifications"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "read_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "notification_reads_notification_user_unique" UNIQUE ("notification_id", "user_id")
);

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
);
