import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "middleware/auth.guard";
import { RequirePermission } from "middleware/permission.decorator";
import { PermissionGuard } from "middleware/permission.guard";
import { PayrollService } from "modules/payroll/payroll.service";

@UseGuards(AuthGuard, PermissionGuard)
@Controller("payroll")
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * Manual trigger for the monthly payroll job -- same logic the 1st-of-month cron runs, exposed
   * so it can be run on demand (testing, or catching up a missed month) instead of only waiting
   * for the schedule. Gated on "settings" MANAGE, the same bar as other admin-only operational
   * actions in this codebase.
   */
  @RequirePermission("settings", "MANAGE")
  @Post("run")
  async runPayroll(@Body() dto: { period?: string }) {
    const period = dto.period ?? new Date().toISOString().slice(0, 7);
    const result = await this.payrollService.generatePayrollExpenses(period);
    return { data: { period, ...result } };
  }
}
