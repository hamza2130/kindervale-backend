import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PERMISSION_KEY, SKIP_PERMISSION_KEY, type PermissionRequirement } from "middleware/permission.decorator";
import { RoleService } from "modules/role/role.service";
import type { UserRole } from "models/users";

const normalizeTokenRole = (role: string): UserRole => {
  const normalized = role.trim().toUpperCase().replace(/[\s-]+/g, "");
  return normalized === "DAYCAREADMIN" || normalized === "DAYCARE_ADMIN" ? "DAYCAREADMIN" : (normalized as UserRole);
};

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly roleService: RoleService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
    if (skip) return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const role = request.user?.role ? normalizeTokenRole(request.user.role) : undefined;
    if (!role) throw new ForbiddenException("User role is required");

    const allowed = await this.roleService.userRoleCan(role, requirement);
    if (!allowed) throw new ForbiddenException("You do not have permission to perform this action");

    return true;
  }
}
