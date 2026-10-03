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
  // "loopback" only trusts X-Forwarded-* from 127.0.0.1, which is wrong behind Render's
  // load balancer -- every real client then resolves to the same IP, so the rate limiter
  // (below) puts all users in one shared bucket. Trust exactly one hop (the platform's own
  // proxy) by default; override via TRUST_PROXY_HOPS if the deployment adds more hops.
  app.set("trust proxy", process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  const allowedOrigins = [
    ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : []),
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
  ];
  // Vercel hands every branch/PR its own preview URL (kindervaleportal-git-<branch>-<team>.vercel.app),
  // so a fixed allowlist can't cover a staging frontend without editing this env var on every new
  // branch. CORS_ORIGIN_PATTERN is an optional regex for that case -- unset in production, where
  // the fixed CORS_ORIGINS list is still the only thing checked, same as before this change.
  const corsOriginPattern = process.env.CORS_ORIGIN_PATTERN ? new RegExp(process.env.CORS_ORIGIN_PATTERN) : null;
  app.enableCors({
    origin: (origin, callback) => {
      // No Origin header at all (curl, server-to-server, same-origin) -- always allowed, matching
      // this app's own prior behavior and every curl-based check used throughout this project.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (corsOriginPattern && corsOriginPattern.test(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(process.env.PORT ?? 5000);
})();
