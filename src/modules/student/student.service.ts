import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import { and, asc, count, desc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import { parentsTable, studentsTable, type Student } from "models/school";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";
import type { CreateStudentDto, StudentListQueryDto, UpdateStudentDto } from "modules/student/student.dto";

@Injectable()
export class StudentService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createStudent(dto: CreateStudentDto): Promise<Student> {
    await this.validateRelations(dto.userId, dto.parentId);
    let admissionNo = dto.admissionNo?.trim() || "";
    if (!admissionNo) {
      const year = new Date().getFullYear();
      const [{ total }] = await this.databaseService.db
        .select({ total: count() })
        .from(studentsTable);
      admissionNo = `KV-${year}-${String(total + 1).padStart(4, "0")}`;
    }

    const [existingStudent] = await this.databaseService.db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(eq(studentsTable.admissionNo, admissionNo))
      .limit(1);

    if (existingStudent) throw new ConflictException("Admission number already exists");

    const [student] = await this.databaseService.db.insert(studentsTable).values({ ...dto, admissionNo }).returning();
    if (!student) throw new ConflictException("Failed to create student");

    return student;
  }

  async getStudents(query: StudentListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const where = this.buildStudentWhere(query);
    const sortColumn = studentsTable[query.sortBy ?? "createdAt"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [items, [{ total }]] = await Promise.all([
      this.databaseService.db.select().from(studentsTable).where(where).orderBy(orderBy).limit(limit).offset(offset),
      this.databaseService.db.select({ total: count() }).from(studentsTable).where(where)
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

  async getStudent(id: string): Promise<Student> {
    const [student] = await this.databaseService.db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
    if (!student) throw new NotFoundException("Student not found");
    return student;
  }

  async updateStudent(id: string, dto: UpdateStudentDto): Promise<Student> {
    await this.validateRelations(dto.userId, dto.parentId);

    if (dto.admissionNo) {
      const [existingStudent] = await this.databaseService.db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(and(eq(studentsTable.admissionNo, dto.admissionNo), ne(studentsTable.id, id)))
        .limit(1);

      if (existingStudent) throw new ConflictException("Admission number already exists");
    }

    const [student] = await this.databaseService.db
      .update(studentsTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(studentsTable.id, id))
      .returning();

    if (!student) throw new NotFoundException("Student not found");
    return student;
  }

  async deleteStudent(id: string): Promise<void> {
    const [student] = await this.databaseService.db
      .delete(studentsTable)
      .where(eq(studentsTable.id, id))
      .returning({ id: studentsTable.id });

    if (!student) throw new NotFoundException("Student not found");
  }

  private async validateRelations(userId?: string, parentId?: string) {
    if (userId) {
      const [user] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user) throw new NotFoundException("User not found");
    }

    if (parentId) {
      const [parent] = await this.databaseService.db
        .select({ id: parentsTable.id })
        .from(parentsTable)
        .where(eq(parentsTable.id, parentId))
        .limit(1);
      if (!parent) throw new NotFoundException("Parent not found");
    }
  }

  private buildStudentWhere(query: StudentListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.className) conditions.push(eq(studentsTable.className, query.className));
    if (query.parentId) conditions.push(eq(studentsTable.parentId, query.parentId));
    if (query.feeStatus) conditions.push(eq(studentsTable.feeStatus, query.feeStatus));
    if (query.search) {
      const searchCondition = or(
        ilike(studentsTable.name, `%${query.search}%`),
        ilike(studentsTable.admissionNo, `%${query.search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    return conditions.length ? and(...conditions) : undefined;
  }
}
