import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import { count, eq } from "drizzle-orm";
import {
  classesTable,
  expensesTable,
  feesTable,
  studentsTable,
} from "models/school";
import usersTable from "models/users";
import { DatabaseService } from "modules/database/database.service";

@Injectable()
export class DemoDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoDataService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onApplicationBootstrap() {
    try {
      await this.databaseService.whenReady();
      await this.seedStudents();
      await this.seedFees();
      await this.seedExpenses();
    } catch (error) {
      this.logger.warn("Demo data seeding skipped: " + (error as Error).message);
    }
  }

  private async seedStudents() {
    const [{ total }] = await this.databaseService.db
      .select({ total: count() })
      .from(studentsTable);
    if (total > 0) return;

    const students = [
      { name: "Zara Ahmed", className: "KG", age: 5, admissionNo: "KV-2026-001", birthday: "2021-03-15" },
      { name: "Ali Hassan", className: "KG", age: 5, admissionNo: "KV-2026-002", birthday: "2021-06-22" },
      { name: "Fatima Noor", className: "Nursery", age: 4, admissionNo: "KV-2026-003", birthday: "2022-01-10" },
      { name: "Omar Farooq", className: "Nursery", age: 4, admissionNo: "KV-2026-004", birthday: "2022-04-05" },
      { name: "Ayesha Khan", className: "Pre-Nursery", age: 3, admissionNo: "KV-2026-005", birthday: "2023-02-28" },
      { name: "Ibrahim Malik", className: "Grade 1", age: 6, admissionNo: "KV-2026-006", birthday: "2020-08-12" },
      { name: "Maryam Siddiqui", className: "Grade 1", age: 6, admissionNo: "KV-2026-007", birthday: "2020-11-30" },
      { name: "Hamza Raza", className: "Grade 2", age: 7, admissionNo: "KV-2026-008", birthday: "2019-07-19" },
      { name: "Sana Malik", className: "School Readiness", age: 3, admissionNo: "KV-2026-009", birthday: "2023-09-01" },
      { name: "Bilal Ahmed", className: "Grade 2", age: 7, admissionNo: "KV-2026-010", birthday: "2019-12-25" },
    ];

    for (const s of students) {
      await this.databaseService.db
        .insert(studentsTable)
        .values({
          id: createId(),
          name: s.name,
          className: s.className,
          age: s.age,
          admissionNo: s.admissionNo,
          birthday: s.birthday,
          attendance: Math.floor(80 + Math.random() * 20),
          feeStatus: "PENDING",
        })
        .onConflictDoNothing();
    }
    this.logger.log(`Seeded ${students.length} students`);
  }

  private async seedFees() {
    const [{ total }] = await this.databaseService.db
      .select({ total: count() })
      .from(feesTable);
    if (total > 0) return;

    const allStudents = await this.databaseService.db.select().from(studentsTable);
    if (!allStudents.length) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    let seeded = 0;

    for (const student of allStudents) {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const prevDue = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-05`;
      await this.databaseService.db
        .insert(feesTable)
        .values({
          id: createId(),
          invoice: `INV-${prevYear}${String(prevMonth + 1).padStart(2, "0")}-${student.admissionNo}`,
          studentId: student.id,
          amount: "8500.00",
          scholarship: 0,
          dueDate: prevDue,
          status: "PAID",
        })
        .onConflictDoNothing();
      seeded++;

      const curDue = `${year}-${String(month + 1).padStart(2, "0")}-05`;
      const isPaid = Math.random() > 0.6;
      const isPartial = !isPaid && Math.random() > 0.5;
      await this.databaseService.db
        .insert(feesTable)
        .values({
          id: createId(),
          invoice: `INV-${year}${String(month + 1).padStart(2, "0")}-${student.admissionNo}`,
          studentId: student.id,
          amount: "8500.00",
          scholarship: student.className === "KG" ? 10 : 0,
          dueDate: curDue,
          status: isPaid ? "PAID" : isPartial ? "PARTIAL" : "PENDING",
        })
        .onConflictDoNothing();
      seeded++;
    }
    this.logger.log(`Seeded ${seeded} fee records`);
  }

  private async seedExpenses() {
    const [{ total }] = await this.databaseService.db
      .select({ total: count() })
      .from(expensesTable);
    if (total > 0) return;

    const [admin] = await this.databaseService.db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.role, "ADMIN"))
      .limit(1);
    const adminId = admin?.id ?? null;

    const now = new Date();
    const expenses = [
      { title: "Classroom Supplies", category: "Supplies", amount: "12500.00", daysAgo: 2 },
      { title: "Electricity Bill", category: "Utilities", amount: "28000.00", daysAgo: 5 },
      { title: "Staff Lunch", category: "Food", amount: "4500.00", daysAgo: 7 },
      { title: "Art Materials", category: "Supplies", amount: "6200.00", daysAgo: 10 },
      { title: "Building Maintenance", category: "Maintenance", amount: "15000.00", daysAgo: 14 },
      { title: "Water Bill", category: "Utilities", amount: "8500.00", daysAgo: 20 },
      { title: "Printer Ink & Paper", category: "Supplies", amount: "3800.00", daysAgo: 25 },
      { title: "Fire Safety Inspection", category: "Safety", amount: "5000.00", daysAgo: 30 },
    ];

    for (const e of expenses) {
      const d = new Date(now);
      d.setDate(d.getDate() - e.daysAgo);
      await this.databaseService.db
        .insert(expensesTable)
        .values({
          id: createId(),
          title: e.title,
          category: e.category,
          amount: e.amount,
          date: d.toISOString().slice(0, 10),
          notes: "",
          createdBy: adminId,
        })
        .onConflictDoNothing();
    }
    this.logger.log(`Seeded ${expenses.length} expense records`);
  }
}
