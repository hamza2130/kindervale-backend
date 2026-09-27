import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { User } from "middleware/user.decorator";
import { CreateHomeworkDto, HomeworkListQueryDto, UpdateHomeworkDto } from "modules/homework/homework.dto";
import { HomeworkService } from "modules/homework/homework.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("homework")
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @RequirePermission("homework", "CREATE")
  @Post()
  async createHomework(
    @Body() dto: CreateHomeworkDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("homeroomClassName") homeroomClassName?: string | null
  ) {
    return { data: await this.homeworkService.createHomework(dto, userId, { role, homeroomClassName }) };
  }

  @RequirePermission("homework", "READ")
  @Get()
  async getHomework(@Query() query: HomeworkListQueryDto, @User("role") role: string, @User("homeroomClassName") homeroomClassName?: string | null) {
    return { data: await this.homeworkService.getHomework(query, { role, homeroomClassName }) };
  }

  @RequirePermission("homework", "READ")
  @Get(":id")
  async getHomeworkItem(@Param() { id }: ParamDto, @User("role") role: string, @User("homeroomClassName") homeroomClassName?: string | null) {
    return { data: await this.homeworkService.getHomeworkItem(id, { role, homeroomClassName }) };
  }

  @RequirePermission("homework", "UPDATE")
  @Patch(":id")
  async updateHomework(
    @Param() { id }: ParamDto,
    @Body() dto: UpdateHomeworkDto,
    @User("role") role: string,
    @User("homeroomClassName") homeroomClassName?: string | null
  ) {
    return { data: await this.homeworkService.updateHomework(id, dto, { role, homeroomClassName }) };
  }

  @RequirePermission("homework", "DELETE")
  @Delete(":id")
  async deleteHomework(@Param() { id }: ParamDto, @User("role") role: string, @User("homeroomClassName") homeroomClassName?: string | null) {
    await this.homeworkService.deleteHomework(id, { role, homeroomClassName });
    return { message: "Homework deleted successfully" };
  }
}
