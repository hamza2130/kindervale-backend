import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, gte, ilike, lte, or, type SQL } from "drizzle-orm";
import { classesTable, homeworkTable, subjectsTable, type Homework } from "models/school";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";
import type { CreateHomeworkDto, HomeworkListQueryDto, UpdateHomeworkDto } from "modules/homework/homework.dto";

@Injectable()
export class HomeworkService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createHomework(dto: CreateHomeworkDto, teacherIdFromToken?: string): Promise<Homework> {
    const teacherId = dto.teacherId ?? teacherIdFromToken;
    await this.validateRelations(dto.classId, dto.subjectId, teacherId);

    const [homework] = await this.databaseService.db.insert(homeworkTable).values({ ...dto, teacherId }).returning();
    if (!homework) throw new ConflictException("Failed to create homework");
    return homework;
  }

  async getHomework(query: HomeworkListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const where = this.buildHomeworkWhere(query);
    const sortColumn = homeworkTable[query.sortBy ?? "dueDate"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [items, [{ total }]] = await Promise.all([
      this.databaseService.db.select().from(homeworkTable).where(where).orderBy(orderBy).limit(limit).offset(offset),
      this.databaseService.db.select({ total: count() }).from(homeworkTable).where(where)
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getHomeworkItem(id: string): Promise<Homework> {
    const [homework] = await this.databaseService.db.select().from(homeworkTable).where(eq(homeworkTable.id, id)).limit(1);
    if (!homework) throw new NotFoundException("Homework not found");
    return homework;
  }

  async updateHomework(id: string, dto: UpdateHomeworkDto): Promise<Homework> {
    await this.validateRelations(dto.classId, dto.subjectId, dto.teacherId);

    const [homework] = await this.databaseService.db
      .update(homeworkTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(homeworkTable.id, id))
      .returning();

    if (!homework) throw new NotFoundException("Homework not found");
    return homework;
  }

  async deleteHomework(id: string): Promise<void> {
    const [homework] = await this.databaseService.db
      .delete(homeworkTable)
      .where(eq(homeworkTable.id, id))
      .returning({ id: homeworkTable.id });

    if (!homework) throw new NotFoundException("Homework not found");
  }

  private async validateRelations(classId?: string, subjectId?: string, teacherId?: string) {
    if (classId) {
      const [classRoom] = await this.databaseService.db.select({ id: classesTable.id }).from(classesTable).where(eq(classesTable.id, classId)).limit(1);
      if (!classRoom) throw new NotFoundException("Class not found");
    }

    if (subjectId) {
      const [subject] = await this.databaseService.db.select({ id: subjectsTable.id }).from(subjectsTable).where(eq(subjectsTable.id, subjectId)).limit(1);
      if (!subject) throw new NotFoundException("Subject not found");
    }

    if (teacherId) {
      const [teacher] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, teacherId)).limit(1);
      if (!teacher) throw new NotFoundException("Author user not found");
      // Any staff member (teacher, admin, principal, daycare admin) may assign homework.
      // Only parents are disallowed. Previously this rejected everyone but TEACHER, which made
      // an admin assigning homework fail with a 409.
      if (teacher.role === "PARENT") throw new ConflictException("A parent cannot be the author of homework");
    }
  }

  private buildHomeworkWhere(query: HomeworkListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.classId) conditions.push(eq(homeworkTable.classId, query.classId));
    if (query.className) conditions.push(eq(homeworkTable.className, query.className));
    if (query.subjectId) conditions.push(eq(homeworkTable.subjectId, query.subjectId));
    if (query.teacherId) conditions.push(eq(homeworkTable.teacherId, query.teacherId));
    if (query.fromDate) conditions.push(gte(homeworkTable.dueDate, query.fromDate));
    if (query.toDate) conditions.push(lte(homeworkTable.dueDate, query.toDate));
    if (query.search) {
      const searchCondition = or(ilike(homeworkTable.title, `%${query.search}%`), ilike(homeworkTable.subject, `%${query.search}%`));
      if (searchCondition) conditions.push(searchCondition);
    }

    return conditions.length ? and(...conditions) : undefined;
  }
}
