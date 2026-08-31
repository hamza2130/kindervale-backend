import { ConflictException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";
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
  "classes",
  "sections",
  "subjects",
  "attendance",
  "homework",
  "lesson-plans",
  "report-cards",
  "weekly-objectives",
  "homework-submissions",
  "daycare-reports",
  "daycare-resources",
  "fees",
  "exams",
  "timetables",
  "expenses",
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

const defaultRoleAccess: Record<UserRole, Partial<Record<(typeof defaultModules)[number], PermissionAction[]>>> = {
  ADMIN: Object.fromEntries(defaultModules.map((module) => [module, ["MANAGE"]])) as Record<
    (typeof defaultModules)[number],
    PermissionAction[]
  >,
  DAYCAREADMIN: Object.fromEntries(defaultModules.map((module) => [module, ["MANAGE"]])) as Record<
    (typeof defaultModules)[number],
    PermissionAction[]
  >,
  PRINCIPAL: {
    dashboard: ["READ"],
    students: ["READ"],
    parents: ["READ"],
    teachers: ["READ", "UPDATE"],
    classes: ["READ", "UPDATE"],
    sections: ["READ", "UPDATE"],
    subjects: ["READ", "UPDATE"],
    attendance: ["READ"],
    homework: ["READ"],
    "lesson-plans": ["READ", "UPDATE"],
    "report-cards": ["READ", "UPDATE"],
    "weekly-objectives": ["READ", "UPDATE"],
    "homework-submissions": ["READ"],
    "daycare-reports": ["READ"],
    fees: ["READ"],
    notices: ["CREATE", "READ", "UPDATE", "DELETE"],
    calendar: ["READ"],
    documents: ["READ"],
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
    "lesson-plans": ["CREATE", "READ", "UPDATE"],
    "report-cards": ["CREATE", "READ", "UPDATE"],
    // CREATE only: re-submitting replaces the previous entry server-side, so a teacher never
    // needs UPDATE, which is what approves an objective.
    "weekly-objectives": ["CREATE", "READ"],
    "homework-submissions": ["READ"],
    "daycare-reports": ["CREATE", "READ", "UPDATE"],
    notices: ["READ"],
    calendar: ["READ"],
    documents: ["CREATE", "READ"]
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
    documents: ["CREATE", "READ"]
  },
};

@Injectable()
export class RoleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RoleService.name);
  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap() {
    try {
      const result = await this.seedDefaults();
      this.logger.log(`Permissions seeded: ${result.roles} roles, ${result.permissions} permissions`);
    } catch (error) {
      this.logger.warn("Permission seed skipped (DB may not be ready yet)");
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

  async userRoleCan(roleName: UserRole, requirement: PermissionCheckDto): Promise<boolean> {
    if (roleName === "ADMIN" || roleName === "DAYCAREADMIN") return true;

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

    for (const role of roles) {
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
