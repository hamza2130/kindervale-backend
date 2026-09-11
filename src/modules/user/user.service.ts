import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, ne, or, type SQL } from "drizzle-orm";
import usersTable, { type SafeUser, type UserRole } from "models/users";
import { parentsTable, studentsTable } from "models/school";
import teachersTable from "models/teachers";
import { DatabaseService } from "modules/database/database.service";
import { HashService } from "modules/hash/hash.service";
import type { CreateUserDto, GenerateLoginDto, UpdateUserDto, UserListQueryDto } from "modules/user/user.dto";

@Injectable()
export class UserService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly hashService: HashService
  ) {}

  async createUser(dto: CreateUserDto): Promise<SafeUser> {
    const { password: _, ...safeColumns } = getTableColumns(usersTable);

    const [existingUser] = await this.databaseService.db
      .select({ email: usersTable.email, username: usersTable.username })
      .from(usersTable)
      .where(or(eq(usersTable.email, dto.email), eq(usersTable.username, dto.username)))
      .limit(1);

    if (existingUser?.email === dto.email) {
      throw new ConflictException("Email already exists");
    }
    if (existingUser?.username === dto.username) {
      throw new ConflictException("Username already exists");
    }

    const [user] = await this.databaseService.db
      .insert(usersTable)
      .values({
        ...dto,
        password: await this.hashService.hash(dto.password)
      })
      .returning(safeColumns);

    if (!user) {
      throw new ConflictException("Failed to create user");
    }

    return user as SafeUser;
  }

  async getUsers(query: UserListQueryDto) {
    const { password: _, ...safeColumns } = getTableColumns(usersTable);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;
    const where = this.buildUserWhere(query);
    const sortColumn = usersTable[query.sortBy ?? "createdAt"];
    const orderBy = query.sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [users, [{ total }]] = await Promise.all([
      this.databaseService.db.select(safeColumns).from(usersTable).where(where).orderBy(orderBy).limit(limit).offset(offset),
      this.databaseService.db.select({ total: count() }).from(usersTable).where(where)
    ]);

    return {
      items: users as SafeUser[],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getUser(userId: string): Promise<SafeUser> {
    const { password: _, ...safeColumns } = getTableColumns(usersTable);

    const [user] = await this.databaseService.db
      .select(safeColumns)
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user as SafeUser;
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<SafeUser> {
    const { password: _, ...safeColumns } = getTableColumns(usersTable);
    if (dto.email || dto.username) {
      const [existingUser] = await this.databaseService.db
        .select({ email: usersTable.email, username: usersTable.username })
        .from(usersTable)
        .where(
          and(
            or(
              dto.email ? eq(usersTable.email, dto.email) : undefined,
              dto.username ? eq(usersTable.username, dto.username) : undefined
            ),
            ne(usersTable.id, userId)
          )
        )
        .limit(1);

      if (dto.email && existingUser?.email === dto.email) {
        throw new ConflictException("Email already exists");
      }
      if (dto.username && existingUser?.username === dto.username) {
        throw new ConflictException("Username already exists");
      }
    }

    const updateData = {
      ...dto,
      updatedAt: new Date()
    };

    if (dto.password) {
      updateData.password = await this.hashService.hash(dto.password);
    }

    const [user] = await this.databaseService.db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, userId))
      .returning(safeColumns);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user as SafeUser;
  }

  async deleteUser(userId: string): Promise<void> {
    const [deletedUser] = await this.databaseService.db
      .delete(usersTable)
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id });

    if (!deletedUser) {
      throw new NotFoundException("User not found");
    }
  }

  private buildUserWhere(query: UserListQueryDto): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.role) conditions.push(eq(usersTable.role, query.role));
    if (query.status) conditions.push(eq(usersTable.status, query.status));
    if (query.search) {
      const searchCondition = or(
        ilike(usersTable.name, `%${query.search}%`),
        ilike(usersTable.username, `%${query.search}%`),
        ilike(usersTable.email, `%${query.search}%`)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    return conditions.length ? and(...conditions) : undefined;
  }

  /**
   * One-shot "Generate Login" used by the admin portal. Creates the user account
   * with a known, returnable password, creates (or reuses) the matching
   * teacher/parent record, and — for parents — links the selected students via
   * students.parentId so the parent portal can find their children.
   *
   * Returns the plaintext password ONCE so the admin can hand it to the family.
   */
  async generateLogin(dto: GenerateLoginDto) {
    const roleUpper: UserRole = dto.role === "Parent" ? "PARENT" : "TEACHER";

    const { password: _pw, ...safeColumns } = getTableColumns(usersTable);

    // ── Regeneration: if linkedRecordId points to a profile that already has a
    //    user account, reset that account's password instead of creating a duplicate. ──
    if (dto.linkedRecordId) {
      let existingUserId: string | null = null;
      if (dto.role === "Teacher") {
        const [teacher] = await this.databaseService.db
          .select({ userId: teachersTable.userId })
          .from(teachersTable)
          .where(eq(teachersTable.id, dto.linkedRecordId))
          .limit(1);
        existingUserId = teacher?.userId ?? null;
      } else {
        const [parent] = await this.databaseService.db
          .select({ userId: parentsTable.userId })
          .from(parentsTable)
          .where(eq(parentsTable.id, dto.linkedRecordId))
          .limit(1);
        existingUserId = parent?.userId ?? null;
      }

      if (existingUserId) {
        const [existingUser] = await this.databaseService.db
          .select(safeColumns)
          .from(usersTable)
          .where(eq(usersTable.id, existingUserId))
          .limit(1);
        if (existingUser) {
          // Reset password on the existing account.
          const firstName = dto.name.trim().split(/\s+/)[0] || "User";
          const password = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}@2026`;
          await this.databaseService.db
            .update(usersTable)
            .set({ password: await this.hashService.hash(password), updatedAt: new Date() })
            .where(eq(usersTable.id, existingUserId));
          return {
            user: existingUser,
            username: existingUser.username,
            password,
            role: dto.role as "Teacher" | "Parent",
          };
        }
      }
    }

    // A brand-new parent account must be linked to at least one child. Existing accounts
    // (handled by the regeneration branch above) don't re-check this — resetting a password
    // shouldn't require re-selecting children that are already linked.
    if (dto.role === "Parent" && (!dto.studentIds || dto.studentIds.length === 0)) {
      throw new BadRequestException("Select at least one child for a parent login");
    }

    // ── New account creation ──
    // Build a unique username and a readable, shareable password.
    const base = dto.name.trim().toLowerCase().replace(/[^a-z]+/g, "");
    const suffix = Math.floor(10 + Math.random() * 90);
    const username = `${base || "user"}${suffix}`;
    const email = dto.email?.trim() || `${username}@kindervale.local`;
    const firstName = dto.name.trim().split(/\s+/)[0] || "User";
    const password = `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)}@2026`;

    // Guard against collisions before we start inserting.
    const [clash] = await this.databaseService.db
      .select({ id: usersTable.id, email: usersTable.email, username: usersTable.username })
      .from(usersTable)
      .where(or(eq(usersTable.email, email), eq(usersTable.username, username)))
      .limit(1);
    if (clash?.email === email) throw new ConflictException("A login with this email already exists");
    if (clash?.username === username) throw new ConflictException("Username collision, please try again");

    // 1. Create the user account.
    const [user] = await this.databaseService.db
      .insert(usersTable)
      .values({
        name: dto.name.trim(),
        username,
        email,
        password: await this.hashService.hash(password),
        role: roleUpper,
      })
      .returning(safeColumns);
    if (!user) throw new ConflictException("Failed to create user");

    if (dto.role === "Teacher") {
      // 2a. Create the teacher profile linked to this user.
      await this.databaseService.db
        .insert(teachersTable)
        .values({
          userId: user.id,
          className: dto.className?.trim() || "",
          subject: dto.subject?.trim() || "General",
        })
        .onConflictDoNothing();
      return { user, username, password, role: "Teacher" as const };
    }

    // 2b. Parent: create the parent record linked to this user...
    const [parent] = await this.databaseService.db
      .insert(parentsTable)
      .values({ userId: user.id, name: dto.name.trim(), email })
      .returning();
    if (!parent) throw new ConflictException("Failed to create parent record");

    // 3. ...then link every selected student to this parent.
    const ids = dto.studentIds ?? [];
    const found = await this.databaseService.db
      .select({ id: studentsTable.id, parentId: studentsTable.parentId, name: studentsTable.name })
      .from(studentsTable)
      .where(inArray(studentsTable.id, ids));
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((s) => s.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new BadRequestException(`Unknown student id(s): ${missing.join(", ")}`);
    }
    // A student can only have one parent at a time. Silently re-linking an already-linked
    // student would orphan their existing parent's access without anyone noticing — the admin
    // has to unlink the child from their current parent first if this is a correction.
    const alreadyLinked = found.filter((s) => s.parentId);
    if (alreadyLinked.length) {
      throw new ConflictException(
        `Already linked to another parent: ${alreadyLinked.map((s) => s.name).join(", ")}. Unlink the child first if this was a mistake.`
      );
    }
    await this.databaseService.db
      .update(studentsTable)
      .set({ parentId: parent.id, updatedAt: new Date() })
      .where(inArray(studentsTable.id, ids));

    return { user, parent, username, password, role: "Parent" as const, linkedStudentIds: ids };
  }
}
