import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ParamDto } from "common/common.dto";
import { type Response } from "express";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { User } from "middleware/user.decorator";
import {
  CreateCalendarEventDto,
  CreateBackupDto,
  CreateDaycareReportDto,
  CreateDaycareResourceDto,
  CreateDocumentDto,
  CreateExamDto,
  CreateExpenseDto,
  CreateFaqDto,
  CreateFeeDto,
  CreateLeaveRequestDto,
  CreateNotificationDto,
  CreateReportCardDto,
  CreateSchoolPolicyDto,
  CreateTimetableDto,
  CreateWeeklyObjectiveDto,
  ReviewLeaveRequestDto,
  ReviewWeeklyObjectiveDto,
  SubmitHomeworkDto,
  UpdateWeeklyObjectiveDto,
  UpdateCalendarEventDto,
  UpdateDaycareReportDto,
  UpdateDaycareResourceDto,
  UpdateDocumentDto,
  UpdateExamDto,
  UpdateExpenseDto,
  UpdateFaqDto,
  UpdateFeeDto,
  UpdateLeaveRequestDto,
  UpdateNotificationDto,
  UpdateReportCardDto,
  UpdateSchoolPolicyDto,
  UpdateTimetableDto,
  UpsertSettingsDto
} from "modules/school/school.dto";
import { SchoolService } from "modules/school/school.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller()
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @RequirePermission("dashboard", "READ")
  @Get("dashboard")
  async dashboard() {
    return { data: await this.schoolService.dashboard() };
  }

  @RequirePermission("fees", "CREATE")
  @Post("fees")
  async createFee(@Body() dto: CreateFeeDto) {
    return { data: await this.schoolService.createFee(dto) };
  }

  @RequirePermission("fees", "READ")
  @Get("fees")
  async getFees() {
    return { data: await this.schoolService.getFees() };
  }

  @RequirePermission("fees", "READ")
  @Get("fees/:id")
  async getFee(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getFee(id) };
  }

  @RequirePermission("fees", "UPDATE")
  @Patch("fees/:id")
  async updateFee(@Param() { id }: ParamDto, @Body() dto: UpdateFeeDto) {
    return { data: await this.schoolService.updateFee(id, dto) };
  }

  @RequirePermission("fees", "DELETE")
  @Delete("fees/:id")
  async deleteFee(@Param() { id }: ParamDto) {
    await this.schoolService.deleteFee(id);
    return { message: "Fee deleted successfully" };
  }

  @RequirePermission("documents", "CREATE")
  @Post("exams")
  async createExam(@Body() dto: CreateExamDto) {
    return { data: await this.schoolService.createExam(dto) };
  }

  @RequirePermission("documents", "READ")
  @Get("exams")
  async getExams() {
    return { data: await this.schoolService.getExams() };
  }

  @RequirePermission("documents", "READ")
  @Get("exams/:id")
  async getExam(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getExam(id) };
  }

  @RequirePermission("documents", "UPDATE")
  @Patch("exams/:id")
  async updateExam(@Param() { id }: ParamDto, @Body() dto: UpdateExamDto) {
    return { data: await this.schoolService.updateExam(id, dto) };
  }

  @RequirePermission("documents", "DELETE")
  @Delete("exams/:id")
  async deleteExam(@Param() { id }: ParamDto) {
    await this.schoolService.deleteExam(id);
    return { message: "Exam deleted successfully" };
  }

  @RequirePermission("report-cards", "CREATE")
  @Post("report-cards")
  async createReportCard(@Body() dto: CreateReportCardDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createReportCard(dto, userId) };
  }

  @RequirePermission("report-cards", "READ")
  @Get("report-cards")
  async getReportCards() {
    return { data: await this.schoolService.getReportCards() };
  }

  @RequirePermission("report-cards", "READ")
  @Get("report-cards/:id")
  async getReportCard(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getReportCard(id) };
  }

  @RequirePermission("report-cards", "UPDATE")
  @Patch("report-cards/:id")
  async updateReportCard(@Param() { id }: ParamDto, @Body() dto: UpdateReportCardDto) {
    return { data: await this.schoolService.updateReportCard(id, dto) };
  }

  @RequirePermission("report-cards", "UPDATE")
  @Post("report-cards/:id/publish")
  async publishReportCard(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.publishReportCard(id) };
  }

  @RequirePermission("report-cards", "DELETE")
  @Delete("report-cards/:id")
  async deleteReportCard(@Param() { id }: ParamDto) {
    await this.schoolService.deleteReportCard(id);
    return { message: "Report card deleted successfully" };
  }

  @RequirePermission("calendar", "CREATE")
  @Post("calendar-events")
  async createCalendarEvent(@Body() dto: CreateCalendarEventDto) {
    return { data: await this.schoolService.createCalendarEvent(dto) };
  }

  @RequirePermission("calendar", "READ")
  @Get("calendar-events")
  async getCalendarEvents() {
    return { data: await this.schoolService.getCalendarEvents() };
  }

  @RequirePermission("calendar", "READ")
  @Get("calendar-events/:id")
  async getCalendarEvent(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getCalendarEvent(id) };
  }

  @RequirePermission("calendar", "UPDATE")
  @Patch("calendar-events/:id")
  async updateCalendarEvent(@Param() { id }: ParamDto, @Body() dto: UpdateCalendarEventDto) {
    return { data: await this.schoolService.updateCalendarEvent(id, dto) };
  }

  @RequirePermission("calendar", "DELETE")
  @Delete("calendar-events/:id")
  async deleteCalendarEvent(@Param() { id }: ParamDto) {
    await this.schoolService.deleteCalendarEvent(id);
    return { message: "Calendar event deleted successfully" };
  }

  @RequirePermission("calendar", "CREATE")
  @Post("timetables")
  async createTimetable(@Body() dto: CreateTimetableDto) {
    return { data: await this.schoolService.createTimetable(dto) };
  }

  @RequirePermission("calendar", "READ")
  @Get("timetables")
  async getTimetables() {
    return { data: await this.schoolService.getTimetables() };
  }

  @RequirePermission("calendar", "READ")
  @Get("timetables/:id")
  async getTimetable(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getTimetable(id) };
  }

  @RequirePermission("calendar", "UPDATE")
  @Patch("timetables/:id")
  async updateTimetable(@Param() { id }: ParamDto, @Body() dto: UpdateTimetableDto) {
    return { data: await this.schoolService.updateTimetable(id, dto) };
  }

  @RequirePermission("calendar", "DELETE")
  @Delete("timetables/:id")
  async deleteTimetable(@Param() { id }: ParamDto) {
    await this.schoolService.deleteTimetable(id);
    return { message: "Timetable deleted successfully" };
  }

  @RequirePermission("documents", "CREATE")
  @Post("documents")
  async createDocument(@Body() dto: CreateDocumentDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createDocument(dto, userId) };
  }

  @RequirePermission("documents", "CREATE")
  @Post("documents/upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(@UploadedFile() file: any, @Body() dto: CreateDocumentDto, @User("userId") userId: string) {
    return { data: await this.schoolService.uploadDocument(file, dto, userId) };
  }

  @RequirePermission("documents", "READ")
  @Get("documents")
  async getDocuments(@Query("type") type?: string, @Query("uploadedBy") uploadedBy?: string) {
    return { data: await this.schoolService.getDocuments({ type, uploadedBy }) };
  }

  @RequirePermission("documents", "READ")
  @Get("documents/:id")
  async getDocument(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getDocument(id) };
  }

  @RequirePermission("documents", "READ")
  @Get("documents/:id/download")
  async downloadDocument(@Param() { id }: ParamDto, @Res() response: Response) {
    await this.schoolService.streamDocument(id, response);
  }

  @RequirePermission("documents", "UPDATE")
  @Patch("documents/:id")
  async updateDocument(@Param() { id }: ParamDto, @Body() dto: UpdateDocumentDto) {
    return { data: await this.schoolService.updateDocument(id, dto) };
  }

  @RequirePermission("documents", "DELETE")
  @Delete("documents/:id")
  async deleteDocument(@Param() { id }: ParamDto) {
    await this.schoolService.deleteDocument(id);
    return { message: "Document deleted successfully" };
  }

  @RequirePermission("weekly-objectives", "CREATE")
  @Post("weekly-objectives")
  async createWeeklyObjective(@Body() dto: CreateWeeklyObjectiveDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createWeeklyObjective(dto, userId) };
  }

  @RequirePermission("weekly-objectives", "READ")
  @Get("weekly-objectives")
  async getWeeklyObjectives() {
    return { data: await this.schoolService.getWeeklyObjectives() };
  }

  @RequirePermission("weekly-objectives", "UPDATE")
  @Patch("weekly-objectives/:id")
  async updateWeeklyObjective(@Param() { id }: ParamDto, @Body() dto: UpdateWeeklyObjectiveDto) {
    return { data: await this.schoolService.updateWeeklyObjective(id, dto) };
  }

  @RequirePermission("weekly-objectives", "UPDATE")
  @Post("weekly-objectives/:id/review")
  async reviewWeeklyObjective(
    @Param() { id }: ParamDto,
    @Body() dto: ReviewWeeklyObjectiveDto,
    @User("userId") userId: string
  ) {
    return { data: await this.schoolService.reviewWeeklyObjective(id, dto, userId) };
  }

  @RequirePermission("weekly-objectives", "DELETE")
  @Delete("weekly-objectives/:id")
  async deleteWeeklyObjective(@Param() { id }: ParamDto) {
    await this.schoolService.deleteWeeklyObjective(id);
    return { message: "Weekly objective deleted successfully" };
  }

  @RequirePermission("homework-submissions", "READ")
  @Get("homework-submissions")
  async getHomeworkSubmissions(@Query("studentId") studentId?: string) {
    return { data: await this.schoolService.getHomeworkSubmissions(studentId) };
  }

  @RequirePermission("homework-submissions", "CREATE")
  @Post("homework-submissions/:id/submit")
  async submitHomework(@Param() { id }: ParamDto, @Body() dto: SubmitHomeworkDto, @User("userId") userId: string) {
    return { data: await this.schoolService.submitHomework(id, dto, userId) };
  }

  @RequirePermission("documents", "CREATE")
  @Post("leave-requests")
  async createLeaveRequest(@Body() dto: CreateLeaveRequestDto, @User("userId") userId: string, @User("role") role: string) {
    return { data: await this.schoolService.createLeaveRequest(dto, role, userId) };
  }

  @RequirePermission("documents", "READ")
  @Get("leave-requests")
  async getLeaveRequests(@User("userId") userId: string, @User("role") role: string) {
    return { data: await this.schoolService.getLeaveRequests({ userId, role }) };
  }

  @RequirePermission("documents", "READ")
  @Get("leave-requests/:id")
  async getLeaveRequest(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getLeaveRequest(id) };
  }

  @RequirePermission("documents", "UPDATE")
  @Patch("leave-requests/:id")
  async updateLeaveRequest(@Param() { id }: ParamDto, @Body() dto: UpdateLeaveRequestDto) {
    return { data: await this.schoolService.updateLeaveRequest(id, dto) };
  }

  @RequirePermission("documents", "UPDATE")
  @Post("leave-requests/:id/review")
  async reviewLeaveRequest(@Param() { id }: ParamDto, @Body() dto: ReviewLeaveRequestDto, @User("userId") userId: string) {
    return { data: await this.schoolService.reviewLeaveRequest(id, dto, userId) };
  }

  @RequirePermission("documents", "DELETE")
  @Delete("leave-requests/:id")
  async deleteLeaveRequest(@Param() { id }: ParamDto) {
    await this.schoolService.deleteLeaveRequest(id);
    return { message: "Leave request deleted successfully" };
  }

  @RequirePermission("settings", "MANAGE")
  @Post("expenses")
  async createExpense(@Body() dto: CreateExpenseDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createExpense(dto, userId) };
  }

  @RequirePermission("settings", "READ")
  @Get("expenses")
  async getExpenses() {
    return { data: await this.schoolService.getExpenses() };
  }

  @RequirePermission("settings", "READ")
  @Get("expenses/:id")
  async getExpense(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getExpense(id) };
  }

  @RequirePermission("settings", "MANAGE")
  @Patch("expenses/:id")
  async updateExpense(@Param() { id }: ParamDto, @Body() dto: UpdateExpenseDto) {
    return { data: await this.schoolService.updateExpense(id, dto) };
  }

  @RequirePermission("settings", "MANAGE")
  @Delete("expenses/:id")
  async deleteExpense(@Param() { id }: ParamDto) {
    await this.schoolService.deleteExpense(id);
    return { message: "Expense deleted successfully" };
  }

  @RequirePermission("settings", "CREATE")
  @Post("faqs")
  async createFaq(@Body() dto: CreateFaqDto) {
    return { data: await this.schoolService.createFaq(dto) };
  }

  @RequirePermission("settings", "READ")
  @Get("faqs")
  async getFaqs() {
    return { data: await this.schoolService.getFaqs() };
  }

  @RequirePermission("settings", "READ")
  @Get("faqs/:id")
  async getFaq(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getFaq(id) };
  }

  @RequirePermission("settings", "UPDATE")
  @Patch("faqs/:id")
  async updateFaq(@Param() { id }: ParamDto, @Body() dto: UpdateFaqDto) {
    return { data: await this.schoolService.updateFaq(id, dto) };
  }

  @RequirePermission("settings", "DELETE")
  @Delete("faqs/:id")
  async deleteFaq(@Param() { id }: ParamDto) {
    await this.schoolService.deleteFaq(id);
    return { message: "FAQ deleted successfully" };
  }

  @RequirePermission("settings", "CREATE")
  @Post("school-policies")
  async createSchoolPolicy(@Body() dto: CreateSchoolPolicyDto) {
    return { data: await this.schoolService.createSchoolPolicy(dto) };
  }

  @RequirePermission("settings", "READ")
  @Get("school-policies")
  async getSchoolPolicies() {
    return { data: await this.schoolService.getSchoolPolicies() };
  }

  @RequirePermission("settings", "READ")
  @Get("school-policies/:id")
  async getSchoolPolicy(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getSchoolPolicy(id) };
  }

  @RequirePermission("settings", "UPDATE")
  @Patch("school-policies/:id")
  async updateSchoolPolicy(@Param() { id }: ParamDto, @Body() dto: UpdateSchoolPolicyDto) {
    return { data: await this.schoolService.updateSchoolPolicy(id, dto) };
  }

  @RequirePermission("settings", "DELETE")
  @Delete("school-policies/:id")
  async deleteSchoolPolicy(@Param() { id }: ParamDto) {
    await this.schoolService.deleteSchoolPolicy(id);
    return { message: "School policy deleted successfully" };
  }

  @RequirePermission("daycare-reports", "CREATE")
  @Post("daycare-reports")
  async createDaycareReport(@Body() dto: CreateDaycareReportDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createDaycareReport(dto, userId) };
  }

  @RequirePermission("daycare-reports", "READ")
  @Get("daycare-reports")
  async getDaycareReports() {
    return { data: await this.schoolService.getDaycareReports() };
  }

  @RequirePermission("daycare-reports", "READ")
  @Get("daycare-reports/:id")
  async getDaycareReport(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getDaycareReport(id) };
  }

  @RequirePermission("daycare-reports", "UPDATE")
  @Patch("daycare-reports/:id")
  async updateDaycareReport(@Param() { id }: ParamDto, @Body() dto: UpdateDaycareReportDto) {
    return { data: await this.schoolService.updateDaycareReport(id, dto) };
  }

  @RequirePermission("daycare-reports", "DELETE")
  @Delete("daycare-reports/:id")
  async deleteDaycareReport(@Param() { id }: ParamDto) {
    await this.schoolService.deleteDaycareReport(id);
    return { message: "Daycare report deleted successfully" };
  }

  @RequirePermission("documents", "CREATE")
  @Post("daycare-resources")
  async createDaycareResource(@Body() dto: CreateDaycareResourceDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createDaycareResource(dto, userId) };
  }

  @RequirePermission("documents", "READ")
  @Get("daycare-resources")
  async getDaycareResources() {
    return { data: await this.schoolService.getDaycareResources() };
  }

  @RequirePermission("documents", "READ")
  @Get("daycare-resources/:id")
  async getDaycareResource(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getDaycareResource(id) };
  }

  @RequirePermission("documents", "UPDATE")
  @Patch("daycare-resources/:id")
  async updateDaycareResource(@Param() { id }: ParamDto, @Body() dto: UpdateDaycareResourceDto) {
    return { data: await this.schoolService.updateDaycareResource(id, dto) };
  }

  @RequirePermission("documents", "DELETE")
  @Delete("daycare-resources/:id")
  async deleteDaycareResource(@Param() { id }: ParamDto) {
    await this.schoolService.deleteDaycareResource(id);
    return { message: "Daycare resource deleted successfully" };
  }

  @RequirePermission("settings", "MANAGE")
  @Post("backups")
  async createBackup(@Body() dto: CreateBackupDto, @User("userId") userId: string) {
    return { data: await this.schoolService.createBackup(dto, userId) };
  }

  @RequirePermission("settings", "MANAGE")
  @Get("backups")
  async getBackups() {
    return { data: await this.schoolService.getBackups() };
  }

  @RequirePermission("settings", "MANAGE")
  @Get("backups/:id")
  async getBackup(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getBackup(id) };
  }

  @RequirePermission("notices", "CREATE")
  @Post("notifications")
  async createNotification(@Body() dto: CreateNotificationDto) {
    return { data: await this.schoolService.createNotification(dto) };
  }

  @RequirePermission("notices", "READ")
  @Get("notifications")
  async getNotifications(@User("userId") userId: string) {
    return { data: await this.schoolService.getNotificationsForUser(userId) };
  }

  // Marking as read only ever writes the caller's own row, so plain read access is enough.
  @RequirePermission("notices", "READ")
  @Post("notifications/read-all")
  async markAllNotificationsRead(@User("userId") userId: string) {
    return { data: await this.schoolService.markAllNotificationsRead(userId) };
  }

  @RequirePermission("notices", "READ")
  @Post("notifications/:id/read")
  async markNotificationRead(@Param() { id }: ParamDto, @User("userId") userId: string) {
    return { data: await this.schoolService.markNotificationRead(id, userId) };
  }

  @RequirePermission("notices", "READ")
  @Get("notifications/:id")
  async getNotification(@Param() { id }: ParamDto) {
    return { data: await this.schoolService.getNotification(id) };
  }

  @RequirePermission("notices", "UPDATE")
  @Patch("notifications/:id")
  async updateNotification(@Param() { id }: ParamDto, @Body() dto: UpdateNotificationDto) {
    return { data: await this.schoolService.updateNotification(id, dto) };
  }

  @RequirePermission("notices", "DELETE")
  @Delete("notifications/:id")
  async deleteNotification(@Param() { id }: ParamDto) {
    await this.schoolService.deleteNotification(id);
    return { message: "Notification deleted successfully" };
  }

  @RequirePermission("settings", "READ")
  @Get("settings")
  async getSettings() {
    return { data: await this.schoolService.getSettings() };
  }

  @RequirePermission("settings", "UPDATE")
  @Patch("settings")
  async upsertSettings(@Body() dto: UpsertSettingsDto) {
    return { data: await this.schoolService.upsertSettings(dto) };
  }
}
