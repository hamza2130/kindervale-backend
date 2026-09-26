import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { join } from "node:path";
import { LoggerMiddleware } from "middleware/logger.middleware";
import { AdminModule } from "modules/admin/admin.module";
import { AttendanceModule } from "modules/attendance/attendance.module";
import { AuthModule } from "modules/auth/auth.module";
import { ClassroomModule } from "modules/classroom/classroom.module";
import { DatabaseModule } from "modules/database/database.module";
import { HashModule } from "modules/hash/hash.module";
import { HomeworkModule } from "modules/homework/homework.module";
import { JWTModule } from "modules/jwt/jwt.module";
import { ParentModule } from "modules/parent/parent.module";
import { PayrollModule } from "modules/payroll/payroll.module";
import { RoleModule } from "modules/role/role.module";
import { SchoolModule } from "modules/school/school.module";
import { StudentModule } from "modules/student/student.module";
import { SubjectModule } from "modules/subject/subject.module";
import { TeacherModule } from "modules/teacher/teacher.module";
import { UserModule } from "modules/user/user.module";

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 50 }]
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), ".env"), join(process.cwd(), "..", ".env")]
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    JWTModule,
    HashModule,
    AuthModule,
    ClassroomModule,
    RoleModule,
    UserModule,
    AdminModule,
    AttendanceModule,
    HomeworkModule,
    ParentModule,
    PayrollModule,
    StudentModule,
    SubjectModule,
    TeacherModule,
    SchoolModule
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
