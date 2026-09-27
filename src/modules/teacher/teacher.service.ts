import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, inArray, isNull, notInArray, or, type SQL } from "drizzle-orm";
import { assertPortalAccess, assertPortalForCreate, callerPortal, DAYCARE_CLASS_NAMES } from "common/portal-scope";
import { refreshTokensTable } from "models/auth";
import { classesTable } from "models/school";
import teachersTable, { type Teacher } from "models/teachers";
import usersTable from "models/users";
import { ClassroomService } from "modules/classroom/classroom.service";
import { DatabaseService } from "modules/database/database.service";
import type { CreateTeacherDto, SelfUpdateTeacherDto, TeacherListQueryDto, UpdateTeacherDto } from "modules/teacher/teacher.dto";

type RequestingUser = { userId: string; role: string };

// Admin now creates and manages staff for BOTH portals (Daycare Admin no longer can), so the
// teachers module is the one deliberate exception to the portal boundary the rest of the app
// enforces for Admin. Every other module (students, fees, expenses, daycare-reports, ...) is
// unaffected -- this check is local to this file, not a change to callerPortal() itself.
const isAdminRole = (role?: string): boolean => (role ?? "").trim().toUpperCase().replace(/[\s_-]+/g, "") === "ADMIN";

/** Shape returned by the teacher list/detail endpoints once joined with users. */
export type TeacherWithUser = Teacher & {
  name: string;
  email: string;
};

@Injectable()
export class TeacherService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly classroomService: ClassroomService
  ) {}

  async createTeacher(dto: CreateTeacherDto, requestingUser?: RequestingUser): Promise<Teacher> {
    // Same gap as students: a Daycare Admin's token had nothing but client-side validation
    // stopping it creating a Kindervale staff record. Admin is exempt -- see isAdminRole.
    if (!isAdminRole(requestingUser?.role)) {
      assertPortalForCreate(requestingUser?.role, dto.className);
    }
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

    const { makeHomeroom, salary, ...teacherFields } = dto;
    const [teacher] = await this.databaseService.db
      .insert(teachersTable)
      .values({ ...teacherFields, salary: salary?.toString() })
      .returning();

    if (!teacher) {
      throw new ConflictException("Failed to create teacher");
    }

    if (makeHomeroom) await this.applyHomeroom(teacher.userId, dto.className);

    return teacher;
  }

  /** Resolves className -> class id and delegates to ClassroomService, which handles reassignment. */
  private async applyHomeroom(teacherUserId: string, className: string): Promise<void> {
    const [classRoom] = await this.databaseService.db
      .select({ id: classesTable.id })
      .from(classesTable)
      .where(eq(classesTable.name, className))
      .limit(1);
    if (!classRoom) throw new NotFoundException(`No class named "${className}" to make this teacher homeroom of`);
    await this.classroomService.setHomeroomTeacher(classRoom.id, teacherUserId);
  }

  async getTeachers(query: TeacherListQueryDto, requestingUser?: RequestingUser) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const baseWhere = this.buildTeacherWhere(query);
    const where = isAdminRole(requestingUser?.role) ? baseWhere : this.applyPortalFilter(baseWhere, requestingUser?.role);
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
          salary: teachersTable.salary,
          archivedAt: teachersTable.archivedAt,
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

  async getTeacher(id: string, requestingUser?: RequestingUser): Promise<TeacherWithUser> {
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
        salary: teachersTable.salary,
        archivedAt: teachersTable.archivedAt,
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
    if (!isAdminRole(requestingUser?.role)) {
      assertPortalAccess(requestingUser?.role, teacher.className, "Teacher not found");
    }

    return teacher as TeacherWithUser;
  }

  async getTeacherByUserId(userId: string): Promise<TeacherWithUser> {
    // Self-heal: a teacher account whose profile row was never created (e.g. the login was
    // generated before the profile got linked) would previously 404 here, breaking both the
    // "My Profile" load AND the save. We provision a blank profile on demand so the teacher
    // portal always has a row to read and write.
    await this.ensureTeacherProfileId(userId);

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
        salary: teachersTable.salary,
        archivedAt: teachersTable.archivedAt,
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

  // Called only from PATCH /teachers/me (SelfUpdateTeacherDto: name/phone/qualifications/bio
  // only). SelfUpdateTeacherDto has no salary/className/attendance/makeHomeroom/userId fields,
  // so forwarding it into the general updateTeacher() below can never touch those -- there is
  // nothing on the object for it to destructure.
  async updateTeacherByUserId(userId: string, dto: SelfUpdateTeacherDto): Promise<TeacherWithUser> {
    const teacherId = await this.ensureTeacherProfileId(userId);
    return this.updateTeacher(teacherId, dto);
  }

  /** The Accountant's dedicated salary screen. Not portal-restricted -- Accountant sees both. */
  async updateSalary(id: string, salary: number): Promise<TeacherWithUser> {
    const [teacher] = await this.databaseService.db
      .update(teachersTable)
      .set({ salary: salary.toString(), updatedAt: new Date() })
      .where(eq(teachersTable.id, id))
      .returning({ id: teachersTable.id });
    if (!teacher) throw new NotFoundException("Teacher not found");
    return this.getTeacher(id);
  }

  /**
   * Returns the teacher-profile id for a user, creating a blank profile if none exists yet.
   * Only accounts with the TEACHER role get a profile; anything else is rejected clearly
   * instead of silently creating an orphan row.
   */
  private async ensureTeacherProfileId(userId: string): Promise<string> {
    const [existing] = await this.databaseService.db
      .select({ id: teachersTable.id })
      .from(teachersTable)
      .where(eq(teachersTable.userId, userId))
      .limit(1);
    if (existing) return existing.id;

    const [user] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) throw new NotFoundException("User not found");
    if (user.role !== "TEACHER") throw new ConflictException("Only teacher accounts have a teacher profile");

    const [created] = await this.databaseService.db
      .insert(teachersTable)
      .values({ userId, subject: "General", className: "" })
      .returning({ id: teachersTable.id });
    if (!created) throw new ConflictException("Failed to create teacher profile");
    return created.id;
  }

  // requestingUser is only ever passed from the admin-facing PATCH /teachers/:id route.
  // updateTeacherByUserId's self-service call below deliberately omits it -- a teacher editing
  // their own profile is never portal-restricted, since it's already their own record by
  // definition.
  async updateTeacher(
    id: string,
    dto: UpdateTeacherDto | SelfUpdateTeacherDto,
    requestingUser?: RequestingUser
  ): Promise<TeacherWithUser> {
    // dto may be the narrower SelfUpdateTeacherDto (no makeHomeroom/className/subject/attendance/
    // userId at all) -- cast to read the admin-only fields, which are simply undefined when a
    // teacher is editing their own profile.
    const { name, makeHomeroom, ...teacherFields } = dto as UpdateTeacherDto;
    const adminCaller = isAdminRole(requestingUser?.role);

    if (requestingUser && !adminCaller) {
      const [existing] = await this.databaseService.db
        .select({ className: teachersTable.className })
        .from(teachersTable)
        .where(eq(teachersTable.id, id))
        .limit(1);
      if (!existing) throw new NotFoundException("Teacher not found");
      assertPortalAccess(requestingUser.role, existing.className, "Teacher not found");
      if (teacherFields.className !== undefined) assertPortalForCreate(requestingUser.role, teacherFields.className);
    }

    const [teacher] = await this.databaseService.db
      .update(teachersTable)
      .set({ ...teacherFields, updatedAt: new Date() })
      .where(eq(teachersTable.id, id))
      .returning();

    if (!teacher) {
      throw new NotFoundException("Teacher not found");
    }

    if (makeHomeroom) await this.applyHomeroom(teacher.userId, teacherFields.className ?? teacher.className);

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
        salary: teachersTable.salary,
        archivedAt: teachersTable.archivedAt,
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

  /**
   * A departed teacher is archived, not deleted: the profile row, salary and attendance history
   * all stay untouched (only archivedAt is set, so `includeArchived` can still surface them).
   * Their login is separately revoked -- status -> ARCHIVED (refused at login, same as INACTIVE)
   * and every refresh token invalidated -- and any homeroom assignment pointing at them is
   * cleared so the class isn't left silently pointing at someone who can no longer log in.
   */
  async deleteTeacher(id: string, requestingUser?: RequestingUser): Promise<void> {
    const [existing] = await this.databaseService.db
      .select({ userId: teachersTable.userId, className: teachersTable.className })
      .from(teachersTable)
      .where(eq(teachersTable.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException("Teacher not found");
    if (!isAdminRole(requestingUser?.role)) {
      assertPortalAccess(requestingUser?.role, existing.className, "Teacher not found");
    }

    const now = new Date();
    await this.databaseService.db
      .update(teachersTable)
      .set({ archivedAt: now, updatedAt: now })
      .where(eq(teachersTable.id, id));

    await this.databaseService.db
      .update(classesTable)
      .set({ homeroomTeacherId: null })
      .where(eq(classesTable.homeroomTeacherId, existing.userId));

    await this.databaseService.db.update(usersTable).set({ status: "ARCHIVED", updatedAt: now }).where(eq(usersTable.id, existing.userId));

    await this.databaseService.db
      .update(refreshTokensTable)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokensTable.userId, existing.userId), isNull(refreshTokensTable.revokedAt)));
  }

  private buildTeacherWhere(query: TeacherListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.subject) conditions.push(eq(teachersTable.subject, query.subject));
    if (query.className) conditions.push(eq(teachersTable.className, query.className));
    if (query.attendance) conditions.push(eq(teachersTable.attendance, query.attendance));
    if (!query.includeArchived) conditions.push(isNull(teachersTable.archivedAt));
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

  /** Narrows an already-built WHERE clause to the caller's own portal, if their role has one. */
  private applyPortalFilter(where: SQL | undefined, role?: string): SQL | undefined {
    const portal = callerPortal(role);
    if (!portal) return where;
    const portalCondition =
      portal === "Daycare"
        ? inArray(teachersTable.className, [...DAYCARE_CLASS_NAMES])
        : notInArray(teachersTable.className, [...DAYCARE_CLASS_NAMES]);
    return where ? and(where, portalCondition) : portalCondition;
  }
}

