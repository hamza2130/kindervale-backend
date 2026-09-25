import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { and, eq, isNotNull } from "drizzle-orm";
import { classNameToPortal } from "common/portal-scope";
import { expensesTable } from "models/school";
import teachersTable from "models/teachers";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async runMonthlyPayroll(): Promise<void> {
    const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const result = await this.generatePayrollExpenses(period);
    this.logger.log(`Payroll for ${period}: ${result.created} created, ${result.skipped} already existed`);
  }

  /**
   * One expense row per teacher with a salary set, for the given "YYYY-MM" period. Safe to call
   * more than once for the same period -- an existing (teacherId, period) row is left untouched
   * rather than duplicated. Exposed for manual triggering (see PayrollController) as well as the
   * monthly cron above.
   */
  async generatePayrollExpenses(period: string): Promise<{ created: number; skipped: number }> {
    const salariedTeachers = await this.databaseService.db
      .select({
        userId: teachersTable.userId,
        className: teachersTable.className,
        salary: teachersTable.salary,
        name: usersTable.name
      })
      .from(teachersTable)
      .leftJoin(usersTable, eq(teachersTable.userId, usersTable.id))
      .where(isNotNull(teachersTable.salary));

    let created = 0;
    let skipped = 0;

    for (const teacher of salariedTeachers) {
      if (!teacher.salary) continue;

      const [existing] = await this.databaseService.db
        .select({ id: expensesTable.id })
        .from(expensesTable)
        .where(and(eq(expensesTable.payrollTeacherId, teacher.userId), eq(expensesTable.payrollPeriod, period)))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await this.databaseService.db.insert(expensesTable).values({
        title: `Salary — ${teacher.name ?? "Unknown teacher"} — ${period}`,
        category: "Salary",
        amount: teacher.salary,
        date: `${period}-01`,
        portal: classNameToPortal(teacher.className),
        payrollTeacherId: teacher.userId,
        payrollPeriod: period
      });
      created++;
    }

    return { created, skipped };
  }
}
