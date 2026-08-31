import { ConflictException, Injectable, Logger, NotFoundException, type OnModuleInit } from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, ne, or, type SQL } from "drizzle-orm";
import { classesTable, sectionsTable, type ClassRoom, type Section } from "models/school";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";
import type {
  ClassListQueryDto,
  CreateClassDto,
  CreateSectionDto,
  SectionListQueryDto,
  UpdateClassDto,
  UpdateSectionDto
} from "modules/classroom/classroom.dto";

@Injectable()
export class ClassroomService implements OnModuleInit {
  private readonly logger = new Logger(ClassroomService.name);
  constructor(private readonly databaseService: DatabaseService) {}

  private static readonly DEFAULT_CLASSES = [
    "School Readiness",
    "Pre-Nursery",
    "Nursery",
    "KG",
    "Grade 1",
    "Grade 2"
  ];

  async onModuleInit() {
    try {
      for (const name of ClassroomService.DEFAULT_CLASSES) {
        await this.databaseService.db
          .insert(classesTable)
          .values({ name, teacher: "", capacity: 30 })
          .onConflictDoNothing();
      }
      this.logger.log(`Default classes seeded (${ClassroomService.DEFAULT_CLASSES.length})`);
    } catch {
      this.logger.warn("Class seeding skipped (DB may not be ready)");
    }
  }

  async createClass(dto: CreateClassDto): Promise<ClassRoom> {
    await this.validateTeacher(dto.homeroomTeacherId);
    await this.ensureClassNameAvailable(dto.name);

    const [classRoom] = await this.databaseService.db.insert(classesTable).values(dto).returning();
    if (!classRoom) throw new ConflictException("Failed to create class");
    return classRoom;
  }

  async getClasses(query: ClassListQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const where = this.buildClassWhere(query);
    const sortColumn = classesTable[query.sortBy ?? "createdAt"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [items, [{ total }]] = await Promise.all([
      this.databaseService.db.select().from(classesTable).where(where).orderBy(orderBy).limit(limit).offset(offset),
      this.databaseService.db.select({ total: count() }).from(classesTable).where(where)
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }

  async getClass(id: string): Promise<ClassRoom> {
    const [classRoom] = await this.databaseService.db.select().from(classesTable).where(eq(classesTable.id, id)).limit(1);
    if (!classRoom) throw new NotFoundException("Class not found");
    return classRoom;
  }

  async updateClass(id: string, dto: UpdateClassDto): Promise<ClassRoom> {
    await this.validateTeacher(dto.homeroomTeacherId);
    if (dto.name) await this.ensureClassNameAvailable(dto.name, id);

    const [classRoom] = await this.databaseService.db
      .update(classesTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(classesTable.id, id))
      .returning();

    if (!classRoom) throw new NotFoundException("Class not found");
    return classRoom;
  }

  async deleteClass(id: string): Promise<void> {
    const [classRoom] = await this.databaseService.db
      .delete(classesTable)
      .where(eq(classesTable.id, id))
      .returning({ id: classesTable.id });

    if (!classRoom) throw new NotFoundException("Class not found");
  }

  async createSection(dto: CreateSectionDto): Promise<Section> {
    await this.getClass(dto.classId);
    await this.ensureSectionAvailable(dto.classId, dto.name);

    const [section] = await this.databaseService.db.insert(sectionsTable).values(dto).returning();
    if (!section) throw new ConflictException("Failed to create section");
    return section;
  }

  async getSections(query: SectionListQueryDto) {
    const where = this.buildSectionWhere(query);
    return this.databaseService.db.select().from(sectionsTable).where(where).orderBy(asc(sectionsTable.name));
  }

  async getSection(id: string): Promise<Section> {
    const [section] = await this.databaseService.db.select().from(sectionsTable).where(eq(sectionsTable.id, id)).limit(1);
    if (!section) throw new NotFoundException("Section not found");
    return section;
  }

  async updateSection(id: string, dto: UpdateSectionDto): Promise<Section> {
    const current = await this.getSection(id);
    const classId = dto.classId ?? current.classId;
    if (dto.classId) await this.getClass(dto.classId);
    if (dto.name) await this.ensureSectionAvailable(classId, dto.name, id);

    const [section] = await this.databaseService.db
      .update(sectionsTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(sectionsTable.id, id))
      .returning();

    if (!section) throw new NotFoundException("Section not found");
    return section;
  }

  async deleteSection(id: string): Promise<void> {
    const [section] = await this.databaseService.db
      .delete(sectionsTable)
      .where(eq(sectionsTable.id, id))
      .returning({ id: sectionsTable.id });

    if (!section) throw new NotFoundException("Section not found");
  }

  private async validateTeacher(userId?: string) {
    if (!userId) return;
    const [user] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) throw new NotFoundException("Homeroom teacher user not found");
    if (user.role !== "TEACHER") throw new ConflictException("Homeroom teacher user role must be TEACHER");
  }

  private async ensureClassNameAvailable(name: string, classId?: string) {
    const where = classId ? and(eq(classesTable.name, name), ne(classesTable.id, classId)) : eq(classesTable.name, name);
    const [existingClass] = await this.databaseService.db.select({ id: classesTable.id }).from(classesTable).where(where).limit(1);
    if (existingClass) throw new ConflictException("Class name already exists");
  }

  private async ensureSectionAvailable(classId: string, name: string, sectionId?: string) {
    const where = sectionId
      ? and(eq(sectionsTable.classId, classId), eq(sectionsTable.name, name), ne(sectionsTable.id, sectionId))
      : and(eq(sectionsTable.classId, classId), eq(sectionsTable.name, name));

    const [existingSection] = await this.databaseService.db
      .select({ id: sectionsTable.id })
      .from(sectionsTable)
      .where(where)
      .limit(1);
    if (existingSection) throw new ConflictException("Section name already exists for this class");
  }

  private buildClassWhere(query: ClassListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];
    if (query.academicYear) conditions.push(eq(classesTable.academicYear, query.academicYear));
    if (query.search) {
      const searchCondition = or(ilike(classesTable.name, `%${query.search}%`), ilike(classesTable.teacher, `%${query.search}%`));
      if (searchCondition) conditions.push(searchCondition);
    }
    return conditions.length ? and(...conditions) : undefined;
  }

  private buildSectionWhere(query: SectionListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];
    if (query.classId) conditions.push(eq(sectionsTable.classId, query.classId));
    if (query.search) conditions.push(ilike(sectionsTable.name, `%${query.search}%`));
    return conditions.length ? and(...conditions) : undefined;
  }
}
