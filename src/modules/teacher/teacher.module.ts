import { Module } from "@nestjs/common";
import { ClassroomModule } from "modules/classroom/classroom.module";
import { TeacherController } from "modules/teacher/teacher.controller";
import { TeacherService } from "modules/teacher/teacher.service";

@Module({
  imports: [ClassroomModule],
  controllers: [TeacherController],
  providers: [TeacherService]
})
export class TeacherModule {}
