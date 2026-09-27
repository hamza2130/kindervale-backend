import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission, SkipPermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { User } from "middleware/user.decorator";
import {
  CreateTeacherDto,
  SelfUpdateTeacherDto,
  TeacherListQueryDto,
  UpdateTeacherDto,
  UpdateTeacherSalaryDto
} from "modules/teacher/teacher.dto";
import { TeacherService } from "modules/teacher/teacher.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("teachers")
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @RequirePermission("teachers", "CREATE")
  @Post()
  async createTeacher(@Body() dto: CreateTeacherDto, @User("userId") userId: string, @User("role") role: string) {
    const teacher = await this.teacherService.createTeacher(dto, { userId, role });
    return { data: teacher };
  }

  @RequirePermission("teachers", "READ")
  @Get()
  async getTeachers(@Query() query: TeacherListQueryDto, @User("userId") userId: string, @User("role") role: string) {
    const teachers = await this.teacherService.getTeachers(query, { userId, role });
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
  async updateMyTeacherProfile(@User("userId") userId: string, @Body() dto: SelfUpdateTeacherDto) {
    const teacher = await this.teacherService.updateTeacherByUserId(userId, dto);
    return { data: teacher };
  }

  @RequirePermission("teachers", "READ")
  @Get(":id")
  async getTeacher(@Param() { id }: ParamDto, @User("userId") userId: string, @User("role") role: string) {
    const teacher = await this.teacherService.getTeacher(id, { userId, role });
    return { data: teacher };
  }

  @RequirePermission("teachers", "UPDATE")
  @Patch(":id")
  async updateTeacher(
    @Param() { id }: ParamDto,
    @Body() dto: UpdateTeacherDto,
    @User("userId") userId: string,
    @User("role") role: string
  ) {
    const teacher = await this.teacherService.updateTeacher(id, dto, { userId, role });
    return { data: teacher };
  }

  @RequirePermission("teachers", "DELETE")
  @Delete(":id")
  async deleteTeacher(@Param() { id }: ParamDto, @User("userId") userId: string, @User("role") role: string) {
    await this.teacherService.deleteTeacher(id, { userId, role });
    return { message: "Teacher deleted successfully" };
  }

  // Separate permission module ("teacher-salary") from the general "teachers" module: after
  // creation, only the Accountant may change a salary; Admin/Principal keep read-only visibility
  // through the regular teacher list/detail, which already includes the salary field.
  @RequirePermission("teacher-salary", "UPDATE")
  @Patch(":id/salary")
  async updateTeacherSalary(@Param() { id }: ParamDto, @Body() dto: UpdateTeacherSalaryDto) {
    const teacher = await this.teacherService.updateSalary(id, dto.salary);
    return { data: teacher };
  }
}
