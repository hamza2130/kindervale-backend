import { ConflictException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
import { classNameToPortal, type SchoolPortal } from "common/portal-scope";
import teachersTable from "models/teachers";
import { permissionsTable, rolePermissionsTable, rolesTable, type PermissionAction } from "models/roles";
import { type UserRole, userRoleEnum } from "models/users";
import { DatabaseService } from "modules/database/database.service";
import {
  AssignPermissionsDto,
  CreatePermissionDto,
  CreateRoleDto,
  PermissionCheckDto,
  UpdatePermissionDto,
  UpdateRoleDto
} from "modules/role/role.dto";

const defaultModules = [
  "dashboard",
  "users",
  "roles",
  "permissions",
  "students",
  "parents",
  "teachers",
  // Split out from "teachers" so only the Accountant can change a salary after creation, while
  // Admin/Principal keep read-only visibility (a teacher's salary is already part of the regular
  // teacher list/detail payload -- this module only gates the write).
  "teacher-salary",
  "classes",
  "sections",
  "subjects",
  "attendance",
  "staff-attendance",
  "homework",
  "report-cards",
  "weekly-objectives",
  "homework-submissions",
  "daycare-reports",
  "daycare-resources",
  "fees",
  "exams",
  "timetables",
  "expenses",
  // Read-only aggregated financial reports (P&L, fee collection by month, overdue/defaulters) --
  // distinct from "expenses"/"fees" (which gate creating/editing the underlying rows) so a role
  // can see the rollups without being able to touch a single invoice or expense.
  "reports",
  "leave-requests",
  "faqs",
  "school-policies",
  "backups",
  "notices",
  "notifications",
  "calendar",
  "documents",
  "settings"
] as const;

// ADMIN and DAYCAREADMIN used to bypass the permission table entirely (see the old
// `userRoleCan` shortcut this replaced) -- every module they touched was seeded with MANAGE, so
// there was never a reason to seed anything narrower. Now that finance access is split out to a
// dedicated Accountant role and Daycare Admin's scope is cut back, these two need their actual
// permission set enforced for the first time. seedDefaults() reconciles (not just adds) these two
// roles' rows on every boot specifically because of that history -- see the comment there.
const defaultRoleAccess: Record<UserRole, Partial<Record<(typeof defaultModules)[number], PermissionAction[]>>> = {
  ADMIN: {
    ...(Object.fromEntries(defaultModules.map((module) => [module, ["MANAGE"]])) as Record<
      (typeof defaultModules)[number],
      PermissionAction[]
    >),
    // Only the Accountant role may create/edit expenses and fees; Admin can see the numbers but
    // not touch them. Same for a teacher's salary once set -- Admin sets it once at creation
    // (that's the "teachers" CREATE grant above, which still includes the salary field), but
    // only the Accountant may change it afterwards.
    expenses: ["READ"],
    fees: ["READ"],
    "teacher-salary": ["READ"]
  },
  DAYCAREADMIN: {
    dashboard: ["READ"],
    students: ["MANAGE"],
    // View-only: staff are added/edited by Admin now, but Daycare Admin still needs to see who
    // exists to pick a name when marking staff attendance.
    teachers: ["READ"],
    // A daycare child's absence is marked here directly (within Daily Activity), not requested --
    // AttendanceService's own portal scoping (callerPortal) already confines every read/write a
    // Daycare Admin makes to daycare-portal students only, the same as it does for Admin/Teacher.
    // No DELETE: bulkMarkAttendance already upserts, so correcting a mistake never needs one.
    attendance: ["CREATE", "READ", "UPDATE"],
    "daycare-reports": ["MANAGE"],
    "staff-attendance": ["MANAGE"],
    // Generate Login, narrowed to parent logins only on the frontend -- teacher accounts are
    // created directly through Admin's staff form now, not a separate generate-login step.
    users: ["CREATE", "READ"],
    parents: ["CREATE", "READ"],
    // Daycare class photos: upload + early-delete. school.service.ts additionally confines both
    // to the Daycare portal and, for delete, to a document Daycare Admin actually uploaded when
    // it isn't a class photo -- the module grant alone would otherwise let them touch any
    // document in the system, Kindervale included.
    documents: ["CREATE", "READ", "DELETE"]
  },
  ACCOUNTANT: {
    dashboard: ["READ"],
    // Read-only: fee rows only carry a student id, so the accountant needs names to make sense of them.
    students: ["READ"],
    expenses: ["CREATE", "READ", "UPDATE", "DELETE"],
    fees: ["CREATE", "READ", "UPDATE"],
    reports: ["READ"],
    // The one write the Accountant is granted on a teacher's record after creation.
    teachers: ["READ"],
    "teacher-salary": ["READ", "UPDATE"]
  },
  // Read-only across the board, including everyone's salary -- Principal never creates, edits,
  // approves or deletes anything through a permission grant here. "Admin approves the reports"
  // (report-cards) is enforced by the report-card workflow itself, not by giving Principal UPDATE.
  PRINCIPAL: {
    dashboard: ["READ"],
    students: ["READ"],
    parents: ["READ"],
    teachers: ["READ"],
    "teacher-salary": ["READ"],
    classes: ["READ"],
    sections: ["READ"],
    subjects: ["READ"],
    attendance: ["READ"],
    "staff-attendance": ["READ"],
    homework: ["READ"],
    "report-cards": ["READ"],
    "weekly-objectives": ["READ"],
    "homework-submissions": ["READ"],
    "daycare-reports": ["READ"],
    fees: ["READ"],
    expenses: ["READ"],
    reports: ["READ"],
    notices: ["READ"],
    calendar: ["READ"],
    documents: ["READ"],
    exams: ["READ"],
    "daycare-resources": ["READ"],
    settings: ["READ"]
  },
  TEACHER: {
    dashboard: ["READ"],
    students: ["READ"],
    classes: ["READ"],
    sections: ["READ"],
    subjects: ["READ"],
    attendance: ["CREATE", "READ", "UPDATE"],
    homework: ["CREATE", "READ", "UPDATE", "DELETE"],
    "report-cards": ["CREATE", "READ", "UPDATE"],
    // CREATE only: re-submitting replaces the previous entry server-side, so a teacher never
    // needs UPDATE, which is what approves an objective.
    "weekly-objectives": ["CREATE", "READ"],
    "homework-submissions": ["READ"],
    // No daycare-reports / daycare-resources: Daycare has no teacher logins, and Daily Activity
    // is entered by the Daycare Admin only.
    notices: ["READ"],
    calendar: ["READ"],
    documents: ["CREATE", "READ"],
    exams: ["READ"]
  },
  PARENT: {
    dashboard: ["READ"],
    students: ["READ"],
    attendance: ["READ"],
    homework: ["READ"],
    "report-cards": ["READ"],
    "weekly-objectives": ["READ"],
    "homework-submissions": ["CREATE", "READ"],
    "daycare-reports": ["READ"],
    fees: ["READ"],
    notices: ["READ"],
    calendar: ["READ"],
    // Leave requests live behind the documents permission, so a parent needs CREATE here to
    // be able to apply for their child's leave at all.
    documents: ["CREATE", "READ"],
    exams: ["READ"],
    "daycare-resources": ["READ"]
  },
};

@Injectable()
export class RoleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoleService.name);
  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap() {
    try {
      await this.databaseService.whenReady();
      const result = await this.seedDefaults();
      this.logger.log(`Permissions seeded: ${result.roles} roles, ${result.permissions} permissions`);
    } catch (error) {
      this.logger.warn("Permission seed skipped: " + (error as Error).message);
    }
  }

  async createRole(dto: CreateRoleDto) {
    const [role] = await this.databaseService.db
      .insert(rolesTable)
      .values({ ...dto, isSystem: false })
      .returning();
    if (!role) throw new ConflictException("Failed to create role");
    return role;
  }

  getRoles() {
    return this.databaseService.db.select().from(rolesTable);
  }

  async getRole(id: string) {
    const [role] = await this.databaseService.db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const [role] = await this.databaseService.db
      .update(rolesTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(rolesTable.id, id))
      .returning();
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async deleteRole(id: string) {
    const [role] = await this.databaseService.db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
    if (!role) throw new NotFoundException("Role not found");
    if (role.isSystem) throw new ConflictException("System roles cannot be deleted");
    await this.databaseService.db.delete(rolesTable).where(eq(rolesTable.id, id));
  }

  async createPermission(dto: CreatePermissionDto) {
    const [permission] = await this.databaseService.db.insert(permissionsTable).values(dto).returning();
    if (!permission) throw new ConflictException("Failed to create permission");
    return permission;
  }

  getPermissions() {
    return this.databaseService.db.select().from(permissionsTable);
  }

  async getPermission(id: string) {
    const [permission] = await this.databaseService.db
      .select()
      .from(permissionsTable)
      .where(eq(permissionsTable.id, id))
      .limit(1);
    if (!permission) throw new NotFoundException("Permission not found");
    return permission;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    const [permission] = await this.databaseService.db
      .update(permissionsTable)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(permissionsTable.id, id))
      .returning();
    if (!permission) throw new NotFoundException("Permission not found");
    return permission;
  }

  async deletePermission(id: string) {
    const [permission] = await this.databaseService.db
      .delete(permissionsTable)
      .where(eq(permissionsTable.id, id))
      .returning({ id: permissionsTable.id });
    if (!permission) throw new NotFoundException("Permission not found");
  }

  async assignPermissions(roleId: string, dto: AssignPermissionsDto) {
    await this.getRole(roleId);
    if (!dto.permissionIds.length) {
      await this.databaseService.db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId));
      return this.getRolePermissions(roleId);
    }

    const permissions = await this.databaseService.db
      .select({ id: permissionsTable.id })
      .from(permissionsTable)
      .where(inArray(permissionsTable.id, dto.permissionIds));

    if (permissions.length !== dto.permissionIds.length) {
      throw new NotFoundException("One or more permissions were not found");
    }

    await this.databaseService.db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId));
    await this.databaseService.db
      .insert(rolePermissionsTable)
      .values(dto.permissionIds.map((permissionId) => ({ roleId, permissionId })));

    return this.getRolePermissions(roleId);
  }

  async getRolePermissions(roleId: string) {
    await this.getRole(roleId);
    return this.databaseService.db
      .select({
        id: permissionsTable.id,
        module: permissionsTable.module,
        action: permissionsTable.action,
        description: permissionsTable.description
      })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .where(eq(rolePermissionsTable.roleId, roleId));
  }

  /**
   * A teacher's portal, taken from the class on their own profile. A teacher with no profile
   * row yet (or an unassigned class) resolves to Kindervale, the same default classNameToPortal
   * gives every unrecognised class name.
   */
  /**
   * The specific homeroom className for a teacher's profile, or null if they have none yet
   * (blank string on the row, or no profile at all). Distinct from teacherPortal() below --
   * that resolves Kindervale vs Daycare; this is decision 7's finer-grained scope, confining a
   * teacher to their own class specifically.
   */
  async teacherHomeroomClassName(userId: string): Promise<string | null> {
    const [teacher] = await this.databaseService.db
      .select({ className: teachersTable.className })
      .from(teachersTable)
      .where(eq(teachersTable.userId, userId))
      .limit(1);
    return teacher?.className || null;
  }

  async teacherPortal(userId: string): Promise<SchoolPortal> {
    const [teacher] = await this.databaseService.db
      .select({ className: teachersTable.className })
      .from(teachersTable)
      .where(eq(teachersTable.userId, userId))
      .limit(1);
    return classNameToPortal(teacher?.className);
  }

  async userRoleCan(roleName: UserRole, requirement: PermissionCheckDto): Promise<boolean> {
    // No more blanket bypass for ADMIN/DAYCAREADMIN -- that's exactly what let Admin (and,
    // until this pass, Daycare Admin) create/edit expenses and fees regardless of what
    // defaultRoleAccess says. Both are now checked against the real permission table like every
    // other role; seedDefaults() below reconciles their rows on every boot so this actually
    // takes effect instead of finding the old "MANAGE everything" grants still sitting there.
    const [permission] = await this.databaseService.db
      .select({ id: permissionsTable.id })
      .from(rolesTable)
      .innerJoin(rolePermissionsTable, eq(rolesTable.id, rolePermissionsTable.roleId))
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .where(
        and(
          eq(rolesTable.name, roleName),
          eq(permissionsTable.module, requirement.module),
          inArray(permissionsTable.action, [requirement.action, "MANAGE"])
        )
      )
      .limit(1);

    return Boolean(permission);
  }

  async seedDefaults() {
    for (const roleName of userRoleEnum.enumValues) {
      await this.databaseService.db
        .insert(rolesTable)
        .values({ name: roleName, description: `${roleName} system role`, isSystem: true })
        .onConflictDoNothing();
    }

    for (const module of defaultModules) {
      for (const action of ["CREATE", "READ", "UPDATE", "DELETE", "MANAGE"] as PermissionAction[]) {
        await this.databaseService.db
          .insert(permissionsTable)
          .values({ module, action, description: `${action} ${module}` })
          .onConflictDoNothing();
      }
    }

    const roles = await this.databaseService.db.select().from(rolesTable);
    const permissions = await this.databaseService.db.select().from(permissionsTable);

    // Reconciled roles: ADMIN and DAYCAREADMIN used to bypass the permission table entirely (see
    // userRoleCan above), so every boot has been seeding them with MANAGE on everything for as
    // long as this system has existed -- those rows are still sitting in role_permissions today.
    // Purely-additive seeding (the loop below, kept for every other role) would never remove them,
    // which would silently defeat the narrower access these two roles now have: the old MANAGE
    // grants would still be found and allowed. These two are wiped and rebuilt from
    // defaultRoleAccess exactly on every boot instead.
    //
    // Every system role is now reconciled, not just these two: Principal's grants were just cut
    // back to read-only (previously had UPDATE on teachers/classes/sections/subjects/report-cards/
    // weekly-objectives and full CRUD on notices) and Accountant just gained "teacher-salary" --
    // additive-only seeding would leave Principal's old broader grants sitting in role_permissions
    // right alongside the narrower ones, so the "MANAGE" fallback in userRoleCan() would still
    // authorize the very actions this change is meant to remove. Any manual tweaks made via
    // assignPermissions() through the admin UI will no longer survive a restart for any role --
    // that trade-off is accepted here in exchange for defaultRoleAccess actually being the source
    // of truth everywhere, not just for two roles.
    const reconciledRoles: UserRole[] = [...userRoleEnum.enumValues];
    for (const role of roles) {
      if (!reconciledRoles.includes(role.name)) continue;
      const roleAccess = defaultRoleAccess[role.name];
      const desiredPermissionIds = new Set(
        Object.entries(roleAccess).flatMap(([module, actions]) =>
          permissions.filter((permission) => permission.module === module && actions.includes(permission.action)).map((p) => p.id)
        )
      );

      const currentGrants = await this.databaseService.db
        .select({ id: rolePermissionsTable.id, permissionId: rolePermissionsTable.permissionId })
        .from(rolePermissionsTable)
        .where(eq(rolePermissionsTable.roleId, role.id));

      const staleGrantIds = currentGrants.filter((grant) => !desiredPermissionIds.has(grant.permissionId)).map((grant) => grant.id);
      if (staleGrantIds.length) {
        await this.databaseService.db.delete(rolePermissionsTable).where(inArray(rolePermissionsTable.id, staleGrantIds));
      }

      const alreadyGranted = new Set(currentGrants.map((grant) => grant.permissionId));
      const missing = [...desiredPermissionIds].filter((id) => !alreadyGranted.has(id));
      if (missing.length) {
        await this.databaseService.db
          .insert(rolePermissionsTable)
          .values(missing.map((permissionId) => ({ roleId: role.id, permissionId })))
          .onConflictDoNothing();
      }
    }

    for (const role of roles) {
      if (reconciledRoles.includes(role.name)) continue;
      const roleAccess = defaultRoleAccess[role.name];
      for (const [module, actions] of Object.entries(roleAccess)) {
        const allowedPermissions = permissions.filter(
          (permission) => permission.module === module && actions.includes(permission.action)
        );
        for (const permission of allowedPermissions) {
          await this.databaseService.db
            .insert(rolePermissionsTable)
            .values({ roleId: role.id, permissionId: permission.id })
            .onConflictDoNothing();
        }
      }
    }

    return { roles: roles.length, permissions: permissions.length };
  }
}
