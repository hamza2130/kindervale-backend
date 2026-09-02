import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { CreateUserDto, GenerateLoginDto, UpdateUserDto, UserListQueryDto } from "modules/user/user.dto";
import { UserService } from "modules/user/user.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @RequirePermission("users", "CREATE")
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    const user = await this.userService.createUser(dto);
    return { data: user };
  }

  @RequirePermission("users", "CREATE")
  @Post("generate-login")
  async generateLogin(@Body() dto: GenerateLoginDto) {
    const result = await this.userService.generateLogin(dto);
    return { data: result };
  }

  @RequirePermission("users", "READ")
  @Get()
  async getUsers(@Query() query: UserListQueryDto) {
    const users = await this.userService.getUsers(query);
    return { data: users };
  }

  @RequirePermission("users", "READ")
  @Get(":id")
  async getUser(@Param() { id }: ParamDto) {
    const user = await this.userService.getUser(id);
    return { data: user };
  }

  @RequirePermission("users", "UPDATE")
  @Patch(":id")
  async updateUser(@Param() { id }: ParamDto, @Body() dto: UpdateUserDto) {
    const user = await this.userService.updateUser(id, dto);
    return { data: user };
  }

  @RequirePermission("users", "DELETE")
  @Delete(":id")
  async deleteUser(@Param() { id }: ParamDto) {
    await this.userService.deleteUser(id);
    return { message: "User deleted successfully" };
  }
}
