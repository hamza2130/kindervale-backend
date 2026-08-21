import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import teachersTable, { type Teacher } from "models/teachers";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";
import type { CreateTeacherDto, TeacherListQueryDto, UpdateTeacherDto } from "modules/teacher/teacher.dto";

/** Shape returned by the teacher list/detail endpoints once joined with users. */
export type TeacherWithUser = Teacher & {
  name: string;
  email: string;
};

@Injectable()
export class TeacherService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createTeacher(dto: CreateTeacherDto): Promise<Teacher> {
    const [user] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, dto.userId)).limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role !== "TEACHER") {
      throw new ConflictException("User role must be TEACHER");
    }

    const [existingTeacher] = await this.databaseService.db
      .select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.userId, dto.userId))
      .limit(1);

    if (existingTeacher) {
      throw new ConflictException("Teacher profile already exists for this user");
    }

    const [teacher] = await this.databaseService.db.insert(teachersTable).values(dto).returning();

    if (!teacher) {
      throw new ConflictException("Failed to create teacher");
    }

    return teacher;
  }

  async getTeachers(query: TeacherListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const where = this.buildTeacherWhere(query);
    const sortColumn = teachersTable[query.sortBy ?? "createdAt"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [items, [{ total }]] = await Promise.all([
      this.databaseService.db
        .select({
          id: teachersTable.id,
          userId: teachersTable.userId,
          phone: teachersTable.phone,
          subject: teachersTable.subject,
          className: teachersTable.className,
          qualifications: teachersTable.qualifications,
          bio: teachersTable.bio,
          attendance: teachersTable.attendance,
          createdAt: teachersTable.createdAt,
          updatedAt: teachersTable.updatedAt,
          name: usersTable.name,
          email: usersTable.email
        })
        .from(teachersTable)
        .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.databaseService.db.select({ total: count() }).from(teachersTable).where(where)
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getTeacher(id: string): Promise<TeacherWithUser> {
    const [teacher] = await this.databaseService.db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
        phone: teachersTable.phone,
        subject: teachersTable.subject,
        className: teachersTable.className,
        qualifications: teachersTable.qualifications,
        bio: teachersTable.bio,
        attendance: teachersTable.attendance,
        createdAt: teachersTable.createdAt,
        updatedAt: teachersTable.updatedAt,
        name: usersTable.name,
        email: usersTable.email
      })
      .from(teachersTable)
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(teachersTable.id, id))
      .limit(1);

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    return teacher as TeacherWithUser;
  }

  async getTeacherByUserId(userId: string): Promise<TeacherWithUser> {
    const [teacher] = await this.databaseService.db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
        phone: teachersTable.phone,
        subject: teachersTable.subject,
        className: teachersTable.className,
        qualifications: teachersTable.qualifications,
        bio: teachersTable.bio,
        attendance: teachersTable.attendance,
        createdAt: teachersTable.createdAt,
        updatedAt: teachersTable.updatedAt,
        name: usersTable.name,
        email: usersTable.email
      })
      .from(teachersTable)
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(teachersTable.userId, userId))
      .limit(1);

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    return teacher as TeacherWithUser;
  }

  async updateTeacherByUserId(userId: string, dto: UpdateTeacherDto): Promise<TeacherWithUser> {
    const teacher = await this.getTeacherByUserId(userId);
    return this.updateTeacher(teacher.id, dto);
  }

  async updateTeacher(id: string, dto: UpdateTeacherDto): Promise<TeacherWithUser> {
    const { name, ...teacherFields } = dto;

    const [teacher] = await this.databaseService.db
      .update(teachersTable)
      .set({ ...teacherFields, updatedAt: new Date() })
      .where(eq(teachersTable.id, id))
      .returning();

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    if (name !== undefined) {
      await this.databaseService.db
        .update(usersTable)
        .set({ name, updatedAt: new Date() })
        .where(eq(usersTable.id, teacher.userId));
    }

    const [updatedTeacher] = await this.databaseService.db
      .select({
        id: teachersTable.id,
        userId: teachersTable.userId,
        phone: teachersTable.phone,
        subject: teachersTable.subject,
        className: teachersTable.className,
        qualifications: teachersTable.qualifications,
        bio: teachersTable.bio,
        attendance: teachersTable.attendance,
        createdAt: teachersTable.createdAt,
        updatedAt: teachersTable.updatedAt,
        name: usersTable.name,
        email: usersTable.email
      })
      .from(teachersTable)
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(eq(teachersTable.id, id))
      .limit(1);

    if (!updatedTeacher) {
      throw new NotFoundException("Teacher not found after update");
    }

    return updatedTeacher as TeacherWithUser;
  }

  async deleteTeacher(id: string): Promise<void> {
    const [teacher] = await this.databaseService.db
      .delete(teachersTable)
      .where(eq(teachersTable.id, id))
      .returning({ id: teachersTable.id });

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }
  }

  private buildTeacherWhere(query: TeacherListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.subject) conditions.push(eq(teachersTable.subject, query.subject));
    if (query.className) conditions.push(eq(teachersTable.className, query.className));
    if (query.attendance) conditions.push(eq(teachersTable.attendance, query.attendance));
    if (query.search) {
      const searchCondition = or(
        ilike(teachersTable.subject, `%${query.search}%`),
        ilike(teachersTable.className, `%${query.search}%`),
        ilike(teachersTable.phone, `%${query.search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    return conditions.length ? and(...conditions) : undefined;
  }
}

