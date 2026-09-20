import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, gte, inArray, lte, ne, notInArray, sql, type SQL } from "drizzle-orm";
import { assertPortalAccess, callerPortal, DAYCARE_CLASS_NAMES, type SchoolPortal } from "common/portal-scope";
import { attendanceTable, classesTable, parentsTable, studentsTable, type Attendance } from "models/school";
import { DatabaseService } from "modules/database/database.service";
import type {
  AttendanceListQueryDto,
  BulkMarkAttendanceDto,
  CreateAttendanceDto,
  UpdateAttendanceDto
} from "modules/attendance/attendance.dto";

type RequestingUser = { userId: string; role: string; portal?: SchoolPortal | null };

@Injectable()
export class AttendanceService {
  constructor(private readonly databaseService: DatabaseService) {}

  async createAttendance(dto: CreateAttendanceDto, markedBy?: string, requestingUser?: RequestingUser): Promise<Attendance> {
    const date = this.normalizeDate(dto.date);
    await this.validateRelations(dto.studentId, dto.classId, requestingUser);
    await this.ensureAttendanceAvailable(dto.studentId, date);

    const [attendance] = await this.databaseService.db.insert(attendanceTable).values({ ...dto, date, markedBy }).returning();
    if (!attendance) throw new ConflictException("Failed to create attendance");

    await this.recalculateStudentAttendance(dto.studentId);
    return attendance;
  }

  async bulkMarkAttendance(dto: BulkMarkAttendanceDto, markedBy?: string, requestingUser?: RequestingUser) {
    if (dto.classId) await this.validateClass(dto.classId);

    const records: Attendance[] = [];
    const date = this.normalizeDate(dto.date);
    const uniqueRecords = Array.from(new Map(dto.records.map((record) => [record.studentId, record])).values());
    // Checked for the whole batch before any row is written, so one cross-portal id can't leave
    // the earlier students in the list already marked.
    await this.assertStudentsInPortal(
      uniqueRecords.map((record) => record.studentId),
      requestingUser
    );
    for (const record of uniqueRecords) {
      await this.validateRelations(record.studentId, dto.classId, requestingUser);

      const existingRecords = await this.databaseService.db
        .select({ id: attendanceTable.id })
        .from(attendanceTable)
        .where(and(eq(attendanceTable.studentId, record.studentId), eq(attendanceTable.date, date)))
        .orderBy(desc(attendanceTable.updatedAt));
      const [existing, ...duplicates] = existingRecords;

      if (existing) {
        const [attendance] = await this.databaseService.db
          .update(attendanceTable)
          .set({ classId: dto.classId, status: record.status, remarks: record.remarks, markedBy, updatedAt: new Date() })
          .where(eq(attendanceTable.id, existing.id))
          .returning();
        records.push(attendance);
        for (const duplicate of duplicates) {
          await this.databaseService.db.delete(attendanceTable).where(eq(attendanceTable.id, duplicate.id));
        }
      } else {
        const [attendance] = await this.databaseService.db
          .insert(attendanceTable)
          .values({ studentId: record.studentId, classId: dto.classId, date, status: record.status, remarks: record.remarks, markedBy })
          .returning();
        records.push(attendance);
      }

      await this.recalculateStudentAttendance(record.studentId);
    }

    return records;
  }

  async getAttendance(query: AttendanceListQueryDto, requestingUser?: RequestingUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const scope = this.buildScopeCondition(requestingUser);
    const base = this.buildAttendanceWhere(query);
    const where = scope ? (base ? and(base, scope) : scope) : base;
    const sortColumn = attendanceTable[query.sortBy ?? "date"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [items, [{ total }]] = await Promise.all([
      this.databaseService.db.select().from(attendanceTable).where(where).orderBy(orderBy).limit(limit).offset(offset),
      this.databaseService.db.select({ total: count() }).from(attendanceTable).where(where)
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getAttendanceRecord(id: string, requestingUser?: RequestingUser): Promise<Attendance> {
    const scope = this.buildScopeCondition(requestingUser);
    const where = scope ? and(eq(attendanceTable.id, id), scope) : eq(attendanceTable.id, id);
    const [attendance] = await this.databaseService.db.select().from(attendanceTable).where(where).limit(1);
    if (!attendance) throw new NotFoundException("Attendance record not found");
    return attendance;
  }

  async updateAttendance(
    id: string,
    dto: UpdateAttendanceDto,
    markedBy?: string,
    requestingUser?: RequestingUser
  ): Promise<Attendance> {
    const current = await this.getAttendanceRecord(id, requestingUser);
    if (dto.classId) await this.validateClass(dto.classId);
    const normalizedDto = dto.date ? { ...dto, date: this.normalizeDate(dto.date) } : dto;
    if (normalizedDto.date) await this.ensureAttendanceAvailable(current.studentId, normalizedDto.date, id);

    const [attendance] = await this.databaseService.db
      .update(attendanceTable)
      .set({ ...normalizedDto, markedBy, updatedAt: new Date() })
      .where(eq(attendanceTable.id, id))
      .returning();

    if (!attendance) throw new NotFoundException("Attendance record not found");
    await this.recalculateStudentAttendance(attendance.studentId);
    return attendance;
  }

  async deleteAttendance(id: string, requestingUser?: RequestingUser): Promise<void> {
    await this.getAttendanceRecord(id, requestingUser);
    const [attendance] = await this.databaseService.db
      .delete(attendanceTable)
      .where(eq(attendanceTable.id, id))
      .returning({ studentId: attendanceTable.studentId });

    if (!attendance) throw new NotFoundException("Attendance record not found");
    await this.recalculateStudentAttendance(attendance.studentId);
  }

  private async validateRelations(studentId: string, classId?: string, requestingUser?: RequestingUser) {
    const [student] = await this.databaseService.db
      .select({ id: studentsTable.id, className: studentsTable.className })
      .from(studentsTable)
      .where(eq(studentsTable.id, studentId))
      .limit(1);
    if (!student) throw new NotFoundException("Student not found");
    // Reported as "not found", same as a missing student, so the response can't be used to probe
    // which ids exist on the other side.
    assertPortalAccess(requestingUser, student.className, "Student not found");
    if (classId) await this.validateClass(classId);
  }

  /** Write-side counterpart of buildScopeCondition: rejects the whole batch if any student belongs to another portal. */
  private async assertStudentsInPortal(studentIds: string[], requestingUser?: RequestingUser) {
    if (!callerPortal(requestingUser) || !studentIds.length) return;
    const students = await this.databaseService.db
      .select({ id: studentsTable.id, className: studentsTable.className })
      .from(studentsTable)
      .where(inArray(studentsTable.id, studentIds));
    for (const student of students) assertPortalAccess(requestingUser, student.className, "Student not found");
  }

  private async validateClass(classId: string) {
    const [classRoom] = await this.databaseService.db.select({ id: classesTable.id }).from(classesTable).where(eq(classesTable.id, classId)).limit(1);
    if (!classRoom) throw new NotFoundException("Class not found");
  }

  private async ensureAttendanceAvailable(studentId: string, date: string, attendanceId?: string) {
    const where = attendanceId
      ? and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.date, date), ne(attendanceTable.id, attendanceId))
      : and(eq(attendanceTable.studentId, studentId), eq(attendanceTable.date, date));

    const [attendance] = await this.databaseService.db.select({ id: attendanceTable.id }).from(attendanceTable).where(where).limit(1);
    if (attendance) throw new ConflictException("Attendance already exists for this student and date");
  }

  private normalizeDate(date: string) {
    return date.slice(0, 10);
  }

  private async recalculateStudentAttendance(studentId: string) {
    const [{ total }] = await this.databaseService.db
      .select({ total: count() })
      .from(attendanceTable)
      .where(eq(attendanceTable.studentId, studentId));

    if (!total) {
      await this.databaseService.db.update(studentsTable).set({ attendance: 0, updatedAt: new Date() }).where(eq(studentsTable.id, studentId));
      return;
    }

    const [{ present }] = await this.databaseService.db
      .select({ present: count() })
      .from(attendanceTable)
      .where(and(eq(attendanceTable.studentId, studentId), sql`${attendanceTable.status} in ('PRESENT', 'LATE', 'EXCUSED')`));

    await this.databaseService.db
      .update(studentsTable)
      .set({ attendance: Math.round((present / total) * 100), updatedAt: new Date() })
      .where(eq(studentsTable.id, studentId));
  }

  /**
   * Restricts attendance rows to what the caller is entitled to see. A PARENT only ever sees their
   * own children -- before this, any parent could list every child's attendance. ADMIN, DAYCAREADMIN
   * and TEACHER are confined to their own portal. PRINCIPAL is unrestricted. Reports "not found"
   * rather than "forbidden" for single records so it can't be used to probe which ids exist.
   */
  private buildScopeCondition(requestingUser?: RequestingUser): SQL | undefined {
    if (!requestingUser) return undefined;
    const db = this.databaseService.db;

    if (requestingUser.role.trim().toUpperCase() === "PARENT") {
      return inArray(
        attendanceTable.studentId,
        db
          .select({ id: studentsTable.id })
          .from(studentsTable)
          .innerJoin(parentsTable, eq(studentsTable.parentId, parentsTable.id))
          .where(eq(parentsTable.userId, requestingUser.userId))
      );
    }

    const portal = callerPortal(requestingUser);
    if (!portal) return undefined;
    const inPortal =
      portal === "Daycare"
        ? inArray(studentsTable.className, [...DAYCARE_CLASS_NAMES])
        : notInArray(studentsTable.className, [...DAYCARE_CLASS_NAMES]);
    return inArray(attendanceTable.studentId, db.select({ id: studentsTable.id }).from(studentsTable).where(inPortal));
  }

  private buildAttendanceWhere(query: AttendanceListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];
    if (query.studentId) conditions.push(eq(attendanceTable.studentId, query.studentId));
    if (query.classId) conditions.push(eq(attendanceTable.classId, query.classId));
    if (query.status) conditions.push(eq(attendanceTable.status, query.status));
    if (query.fromDate) conditions.push(gte(attendanceTable.date, query.fromDate));
    if (query.toDate) conditions.push(lte(attendanceTable.date, query.toDate));
    return conditions.length ? and(...conditions) : undefined;
  }
}
