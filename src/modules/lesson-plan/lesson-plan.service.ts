import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { classesTable, lessonPlansTable, subjectsTable, type LessonPlan } from "models/school";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";
import type {
  CreateLessonPlanDto,
  LessonPlanListQueryDto,
  ReviewLessonPlanDto,
  UpdateLessonPlanDto
} from "modules/lesson-plan/lesson-plan.dto";

@Injectable()
export class LessonPlanService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createLessonPlan(dto: CreateLessonPlanDto, teacherIdFromToken?: string): Promise<LessonPlan> {
    const teacherId = dto.teacherId ?? teacherIdFromToken;
    if (!teacherId) throw new ConflictException("Teacher ID is required");
    await this.validateRelations(dto.classId, dto.subjectId, teacherId);

    const [lessonPlan] = await this.databaseService.db
      .insert(lessonPlansTable)
      .values({ ...dto, teacherId, status: "DRAFT" })
      .returning();

    if (!lessonPlan) throw new ConflictException("Failed to create lesson plan");
    return lessonPlan;
  }

  async getLessonPlans(query: LessonPlanListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const where = this.buildLessonPlanWhere(query);
    const sortColumn = lessonPlansTable[query.sortBy ?? "createdAt"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [items, [{ total }]] = await Promise.all([
      this.databaseService.db.select().from(lessonPlansTable).where(where).orderBy(orderBy).limit(limit).offset(offset),
      this.databaseService.db.select({ total: count() }).from(lessonPlansTable).where(where)
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getLessonPlan(id: string): Promise<LessonPlan> {
    const [lessonPlan] = await this.databaseService.db
      .select()
      .from(lessonPlansTable)
      .where(eq(lessonPlansTable.id, id))
      .limit(1);

    if (!lessonPlan) throw new NotFoundException("Lesson plan not found");
    return lessonPlan;
  }

  async updateLessonPlan(id: string, dto: UpdateLessonPlanDto): Promise<LessonPlan> {
    await this.getLessonPlan(id);
    await this.validateRelations(dto.classId, dto.subjectId);

    const [lessonPlan] = await this.databaseService.db
      .update(lessonPlansTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(lessonPlansTable.id, id))
      .returning();

    if (!lessonPlan) throw new NotFoundException("Lesson plan not found");
    return lessonPlan;
  }

  async submitLessonPlan(id: string): Promise<LessonPlan> {
    const [lessonPlan] = await this.databaseService.db
      .update(lessonPlansTable)
      .set({ status: "PENDING", reviewRemarks: null, reviewedBy: null, reviewedAt: null, updatedAt: new Date() })
      .where(eq(lessonPlansTable.id, id))
      .returning();

    if (!lessonPlan) throw new NotFoundException("Lesson plan not found");
    return lessonPlan;
  }

  async reviewLessonPlan(id: string, dto: ReviewLessonPlanDto, reviewedBy?: string): Promise<LessonPlan> {
    if (reviewedBy) await this.validateReviewer(reviewedBy);
    const updatePayload = {
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.reviewRemarks !== undefined ? { reviewRemarks: dto.reviewRemarks } : {}),
      reviewedBy,
      reviewedAt: new Date(),
      updatedAt: new Date()
    };

    const [lessonPlan] = await this.databaseService.db
      .update(lessonPlansTable)
      .set(updatePayload)
      .where(eq(lessonPlansTable.id, id))
      .returning();

    if (!lessonPlan) throw new NotFoundException("Lesson plan not found");
    return lessonPlan;
  }

  async deleteLessonPlan(id: string): Promise<void> {
    const [lessonPlan] = await this.databaseService.db
      .delete(lessonPlansTable)
      .where(eq(lessonPlansTable.id, id))
      .returning({ id: lessonPlansTable.id });

    if (!lessonPlan) throw new NotFoundException("Lesson plan not found");
  }

  private async validateRelations(classId?: string, subjectId?: string, teacherId?: string) {
    if (classId) {
      const [classRoom] = await this.databaseService.db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(eq(classesTable.id, classId))
        .limit(1);
      if (!classRoom) throw new NotFoundException("Class not found");
    }

    if (subjectId) {
      const [subject] = await this.databaseService.db
        .select({ id: subjectsTable.id })
        .from(subjectsTable)
        .where(eq(subjectsTable.id, subjectId))
        .limit(1);
      if (!subject) throw new NotFoundException("Subject not found");
    }

    if (teacherId) {
      const [teacher] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
      if (!teacher) throw new NotFoundException("Author user not found");
      // Any staff member (teacher, admin, principal, daycare admin) may author a lesson plan.
      // Only parents are disallowed. Previously this rejected everyone but TEACHER, which made
      // an admin creating a lesson plan fail with a 409.
      if (teacher.role === "PARENT") throw new ConflictException("A parent cannot be the author of a lesson plan");
    }
  }

  private async validateReviewer(userId: string) {
    const [user] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) throw new NotFoundException("Reviewer user not found");
  }

  private buildLessonPlanWhere(query: LessonPlanListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.teacherId) conditions.push(eq(lessonPlansTable.teacherId, query.teacherId));
    if (query.classId) conditions.push(eq(lessonPlansTable.classId, query.classId));
    if (query.status) conditions.push(eq(lessonPlansTable.status, query.status));

    return conditions.length ? and(...conditions) : undefined;
  }
}
