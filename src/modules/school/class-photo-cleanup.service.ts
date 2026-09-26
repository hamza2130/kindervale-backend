import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { documentsTable } from "models/school";
import { DatabaseService } from "modules/database/database.service";
import { expiredClassPhotoSql } from "modules/school/class-photo";

@Injectable()
export class ClassPhotoCleanupService {
  private readonly logger = new Logger(ClassPhotoCleanupService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      await this.deleteExpired();
    } catch (error) {
      this.logger.error("Class photo cleanup failed: " + (error as Error).message);
    }
  }

  async deleteExpired(): Promise<number> {
    const removed = await this.databaseService.db
      .delete(documentsTable)
      .where(expiredClassPhotoSql())
      .returning({ id: documentsTable.id });
    if (removed.length) this.logger.log(`Deleted ${removed.length} expired class photo(s)`);
    return removed.length;
  }
}
