import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission, SkipPermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { User } from "middleware/user.decorator";
import { CreateTeacherDto, TeacherListQueryDto, UpdateTeacherDto } from "modules/teacher/teacher.dto";
import { TeacherService } from "modules/teacher/teacher.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("teachers")
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @RequirePermission("teachers", "CREATE")
  @Post()
  async createTeacher(@Body() dto: CreateTeacherDto) {
    const teacher = await this.teacherService.createTeacher(dto);
    return { data: teacher };
  }

  @RequirePermission("teachers", "READ")
  @Get()
  async getTeachers(@Query() query: TeacherListQueryDto) {
    const teachers = await this.teacherService.getTeachers(query);
    return { data: teachers };
  }

  @SkipPermission()
  @Get("me")
  async getMyTeacherProfile(@User("userId") userId: string) {
    const teacher = await this.teacherService.getTeacherByUserId(userId);
    return { data: teacher };
  }

  @SkipPermission()
  @Patch("me")
  async updateMyTeacherProfile(@User("userId") userId: string, @Body() dto: UpdateTeacherDto) {
    const teacher = await this.teacherService.updateTeacherByUserId(userId, dto);
    return { data: teacher };
  }

  @RequirePermission("teachers", "READ")
  @Get(":id")
  async getTeacher(@Param() { id }: ParamDto) {
    const teacher = await this.teacherService.getTeacher(id);
    return { data: teacher };
  }

  @RequirePermission("teachers", "UPDATE")
  @Patch(":id")
  async updateTeacher(@Param() { id }: ParamDto, @Body() dto: UpdateTeacherDto) {
    const teacher = await this.teacherService.updateTeacher(id, dto);
    return { data: teacher };
  }

  @RequirePermission("teachers", "DELETE")
  @Delete(":id")
  async deleteTeacher(@Param() { id }: ParamDto) {
    await this.teacherService.deleteTeacher(id);
    return { message: "Teacher deleted successfully" };
  }
}
