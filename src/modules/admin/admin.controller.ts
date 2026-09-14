import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { CreateAdminDto, UpdateAdminDto } from "modules/admin/admin.dto";
import { AdminService } from "modules/admin/admin.service";

// This controller had no guards at all -- not just unscoped by role, genuinely unauthenticated.
// Anyone with the URL could list every admin's phone/designation, or create, edit and delete
// admin records, with no token of any kind. Confirmed live: a plain fetch() with no
// Authorization header returned 200 with full data. Gated the same way every other controller
// in this codebase already is. Nothing in the frontend calls this with a real request -- the
// "Create Account" self-registration form is client-side only (it writes into an in-memory JS
// object and never reaches the network), so there was no legitimate caller depending on this
// being open.
@UseGuards(AuthGuard, PermissionGuard)
@Controller("admins")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @RequirePermission("users", "CREATE")
  @Post()
  async createAdmin(@Body() dto: CreateAdminDto) {
    const admin = await this.adminService.createAdmin(dto);
    return { data: admin };
  }

  @RequirePermission("users", "READ")
  @Get()
  async getAdmins() {
    const admins = await this.adminService.getAdmins();
    return { data: admins };
  }

  @RequirePermission("users", "READ")
  @Get(":id")
  async getAdmin(@Param() { id }: ParamDto) {
    const admin = await this.adminService.getAdmin(id);
    return { data: admin };
  }

  @RequirePermission("users", "UPDATE")
  @Patch(":id")
  async updateAdmin(@Param() { id }: ParamDto, @Body() dto: UpdateAdminDto) {
    const admin = await this.adminService.updateAdmin(id, dto);
    return { data: admin };
  }

  @RequirePermission("users", "DELETE")
  @Delete(":id")
  async deleteAdmin(@Param() { id }: ParamDto) {
    await this.adminService.deleteAdmin(id);
    return { message: "Admin deleted successfully" };
  }
}
