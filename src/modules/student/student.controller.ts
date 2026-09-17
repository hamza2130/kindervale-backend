import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { User } from "middleware/user.decorator";
import { CreateStudentDto, StudentListQueryDto, UpdateStudentDto } from "modules/student/student.dto";
import { StudentService } from "modules/student/student.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("students")
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @RequirePermission("students", "CREATE")
  @Post()
  async createStudent(@Body() dto: CreateStudentDto, @User("userId") userId: string, @User("role") role: string) {
    return { data: await this.studentService.createStudent(dto, { userId, role }) };
  }

  @RequirePermission("students", "READ")
  @Get()
  async getStudents(
    @Query() query: StudentListQueryDto,
    @User("userId") userId: string,
    @User("role") role: string
  ) {
    return { data: await this.studentService.getStudents(query, { userId, role }) };
  }

  @RequirePermission("students", "READ")
  @Get(":id")
  async getStudent(@Param() { id }: ParamDto, @User("userId") userId: string, @User("role") role: string) {
    return { data: await this.studentService.getStudent(id, { userId, role }) };
  }

  @RequirePermission("students", "UPDATE")
  @Patch(":id")
  async updateStudent(
    @Param() { id }: ParamDto,
    @Body() dto: UpdateStudentDto,
    @User("userId") userId: string,
    @User("role") role: string
  ) {
    return { data: await this.studentService.updateStudent(id, dto, { userId, role }) };
  }

  @RequirePermission("students", "DELETE")
  @Delete(":id")
  async deleteStudent(@Param() { id }: ParamDto, @User("userId") userId: string, @User("role") role: string) {
    await this.studentService.deleteStudent(id, { userId, role });
    return { message: "Student deleted successfully" };
  }
}
