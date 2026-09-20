import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ParamDto } from "common/common.dto";
import type { SchoolPortal } from "common/portal-scope";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { User } from "middleware/user.decorator";
import {
  AttendanceListQueryDto,
  BulkMarkAttendanceDto,
  CreateAttendanceDto,
  UpdateAttendanceDto
} from "modules/attendance/attendance.dto";
import { AttendanceService } from "modules/attendance/attendance.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("attendance")
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @RequirePermission("attendance", "CREATE")
  @Post()
  async createAttendance(
    @Body() dto: CreateAttendanceDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("portal") portal?: SchoolPortal
  ) {
    return { data: await this.attendanceService.createAttendance(dto, userId, { userId, role, portal }) };
  }

  @RequirePermission("attendance", "CREATE")
  @Post("bulk")
  async bulkMarkAttendance(
    @Body() dto: BulkMarkAttendanceDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("portal") portal?: SchoolPortal
  ) {
    return { data: await this.attendanceService.bulkMarkAttendance(dto, userId, { userId, role, portal }) };
  }

  @RequirePermission("attendance", "READ")
  @Get()
  async getAttendance(
    @Query() query: AttendanceListQueryDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("portal") portal?: SchoolPortal
  ) {
    return { data: await this.attendanceService.getAttendance(query, { userId, role, portal }) };
  }

  @RequirePermission("attendance", "READ")
  @Get(":id")
  async getAttendanceRecord(
    @Param() { id }: ParamDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("portal") portal?: SchoolPortal
  ) {
    return { data: await this.attendanceService.getAttendanceRecord(id, { userId, role, portal }) };
  }

  @RequirePermission("attendance", "UPDATE")
  @Patch(":id")
  async updateAttendance(
    @Param() { id }: ParamDto,
    @Body() dto: UpdateAttendanceDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("portal") portal?: SchoolPortal
  ) {
    return { data: await this.attendanceService.updateAttendance(id, dto, userId, { userId, role, portal }) };
  }

  @RequirePermission("attendance", "DELETE")
  @Delete(":id")
  async deleteAttendance(
    @Param() { id }: ParamDto,
    @User("userId") userId: string,
    @User("role") role: string,
    @User("portal") portal?: SchoolPortal
  ) {
    await this.attendanceService.deleteAttendance(id, { userId, role, portal });
    return { message: "Attendance record deleted successfully" };
  }
}
