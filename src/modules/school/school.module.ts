import { Module } from "@nestjs/common";
import { ClassPhotoCleanupService } from "modules/school/class-photo-cleanup.service";
import { SchoolController } from "modules/school/school.controller";
import { SchoolService } from "modules/school/school.service";

@Module({
  controllers: [SchoolController],
  providers: [SchoolService, ClassPhotoCleanupService]
})
export class SchoolModule {}
