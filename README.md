# Kindervale Backend

A secure, modular school management API built with **NestJS** and **PostgreSQL**. The backend powers the Kindervale portal with authentication, role-based access, student and teacher management, attendance tracking, homework, lesson plans, school settings, and administrative workflows.

---

## Key Features

- **Authentication & Authorization:** JWT-based login, refresh tokens, protected routes, permission guards, and role-aware access control.
- **School Operations:** APIs for admins, teachers, parents, students, classrooms, sections, subjects, and school profile management.
- **Academic Management:** Attendance, homework, lesson plans, and subject management modules.
- **Database Persistence:** PostgreSQL connection using Drizzle ORM with migration and database setup scripts.
- **Email Support:** Brevo integration for transactional messages such as OTP and notification emails.
- **Security Middleware:** Helmet, validation pipes, request logging, CORS configuration, throttling, and centralized exception handling.

---

## Project Architecture

```text
kindervale-backend/
|-- src/
|   |-- main.ts                       # NestJS bootstrap, API prefix, CORS, security, global pipes
|   |-- app.module.ts                 # Root module and feature module registration
|   |-- common/                       # Response interceptors, filters, DTOs, helpers
|   |-- middleware/                   # Auth guards, permission guards, decorators, logger
|   |-- models/                       # Database model definitions
|   |-- modules/
|   |   |-- admin/                    # Admin account APIs
|   |   |-- attendance/               # Attendance records and summaries
|   |   |-- auth/                     # Login, OTP, token refresh, logout
|   |   |-- classroom/                # Classes and sections
|   |   |-- database/                 # PostgreSQL and Drizzle connection service
|   |   |-- homework/                 # Homework assignments and submissions
|   |   |-- lesson-plan/              # Lesson plan workflows
|   |   |-- mail/                     # Brevo email delivery service
|   |   |-- parent/                   # Parent management
|   |   |-- role/                     # Roles and permissions
|   |   |-- school/                   # School profile and settings
|   |   |-- student/                  # Student records
|   |   |-- subject/                  # Subject management
|   |   |-- teacher/                  # Teacher records
|   |   `-- user/                     # Shared user management
|   `-- templates/                    # OTP email and text templates
|-- scripts/
|   |-- create-database.ts            # Database creation helper
|   |-- seed-admin.ts                 # Seed default users and roles
|   `-- migrations/                   # SQL migration scripts
|-- test/                             # E2E test configuration and specs
|-- package.json                      # Scripts and dependencies
`-- tsconfig.json                     # TypeScript configuration
```

---

## Tech Stack

- **Framework:** NestJS 11
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** JWT, bcrypt
- **Email:** Brevo API
- **Security:** Helmet, NestJS Throttler, validation pipes
- **Testing:** Jest and Supertest

---

## Quickstart Guide

### 1. Prerequisites

- Node.js 24+
- pnpm 10+ or npm
- PostgreSQL database server
- Brevo account if email delivery is required

### 2. Installation

Clone the repository and enter the backend folder:

```bash
git clone https://github.com/alishbahafeez241/kindervale-backend.git
cd kindervale-backend
```

Install dependencies:

```bash
pnpm install
```

If you prefer npm:

```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the backend root directory:

```env
# Server
PORT=5000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/kindervale

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRE_TIME=15m
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_REFRESH_EXPIRE_TIME=7d

# Development authentication helpers
LOGIN_OTP=0000
DEV_AUTH_BYPASS=false

# Brevo email service
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=no-reply@yourdomain.com
BREVO_SENDER_NAME=Kindervale

# Optional seed user overrides
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=demo123
SEED_ADMIN_NAME=Admin User
```

### 4. Database Setup

Create the database:

```bash
pnpm db:create
```

Apply SQL migrations from `scripts/migrations/` to your PostgreSQL database.

Seed default users and roles:

```bash
pnpm db:seed-admin
```

### 5. Running the Server

Start the development server:

```bash
pnpm dev
```

The API will be available at:

```text
http://localhost:5000/api
```

Build and run production output:

```bash
pnpm build
pnpm start
```

---

## Available Scripts

- `pnpm dev` - Start NestJS in watch mode.
- `pnpm build` - Compile the project.
- `pnpm start` - Run the compiled application from `dist`.
- `pnpm test` - Run unit tests.
- `pnpm test:e2e` - Run end-to-end tests.
- `pnpm lint` - Run ESLint checks.
- `pnpm lint:fix` - Fix lint issues automatically.
- `pnpm format` - Format TypeScript files with Prettier.
- `pnpm db:create` - Create the configured PostgreSQL database.
- `pnpm db:seed-admin` - Seed default application users.

---

## API Notes

- All routes are served under the `/api` prefix.
- CORS is configured for local frontend origins on ports `3000` and `3001`.
- Static files in the `storage` directory are served through `/storage/`.
- Responses are normalized through a global response interceptor.
- Validation uses whitelist mode and rejects unknown DTO properties.

---

## Security & Privacy Note

- Keep `.env`, database credentials, JWT secrets, and API keys out of version control.
- Use strong JWT secrets in production.
- Disable development helpers such as `DEV_AUTH_BYPASS` before deployment.
- Restrict CORS origins to trusted production domains when deploying.

---

## License

This project is private and currently marked as unlicensed in `package.json`.
