import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import { HttpExceptionFilter } from "common/http-exception.filter";
import { ResponseInterceptor } from "common/response.interceptor";
import { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { join } from "node:path";
import { AppModule } from "src/app.module";

const apiRoots = [
  "auth",
  "users",
  "admins",
  "teachers",
  "parents",
  "students",
  "classes",
  "sections",
  "subjects",
  "attendance",
  "homework",
  "lesson-plans",
  "homework-submissions",
  "weekly-objectives",
  "roles",
  "permissions",
  "dashboard",
  "fees",
  "exams",
  "report-cards",
  "calendar-events",
  "timetables",
  "documents",
  "leave-requests",
  "expenses",
  "faqs",
  "school-policies",
  "daycare-reports",
  "daycare-resources",
  "backups",
  "notifications",
  "settings"
];

// Bootstrap
(async (): Promise<undefined> => {
  const app: NestExpressApplication = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix("api");
  app.useStaticAssets(join(process.cwd(), "storage"), { prefix: "/storage/" });
  app.use((request: Request, _response: Response, next: NextFunction) => {
    const root = request.path.split("/").filter(Boolean)[0];
    if (root && apiRoots.includes(root)) {
      request.url = `/api${request.url}`;
    }
    next();
  });
  app.set("trust proxy", "loopback");
  app.use(helmet());
    app.enableCors({
    origin: [
      ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : []),
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001"
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 5000);
})();
