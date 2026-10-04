import { randomInt } from "node:crypto";
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { normalizePortalRole } from "common/role-normalizer";
import { and, desc, eq, gt, ilike, isNull, or } from "drizzle-orm";
import { passwordResetTokensTable, refreshTokensTable } from "models/auth";
import adminsTable from "models/admins";
import { classNameToPortal } from "common/portal-scope";
import { classesTable, parentsTable, studentsTable } from "models/school";
import teachersTable from "models/teachers";
import usersTable, { type SafeUser, type UserRole } from "models/users";
import { DatabaseService } from "modules/database/database.service";
import { HashService } from "modules/hash/hash.service";
import { JWTService } from "modules/jwt/jwt.service";
import { MailService } from "modules/mail/mail.service";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  PortalRole,
  RefreshTokenDto,
  ResetPasswordDto
} from "modules/auth/auth.dto";

const portalRoleToUserRole: Record<PortalRole, UserRole> = {
  admin: "ADMIN",
  daycare_admin: "DAYCAREADMIN",
  principal: "PRINCIPAL",
  teacher: "TEACHER",
  parent: "PARENT",
  accountant: "ACCOUNTANT"
};

const userRoleToPortalRole: Record<UserRole, PortalRole> = {
  ADMIN: "admin",
  DAYCAREADMIN: "daycare_admin",
  PRINCIPAL: "principal",
  TEACHER: "teacher",
  PARENT: "parent",
  ACCOUNTANT: "accountant"
};

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly hashService: HashService,
    private readonly jwtService: JWTService,
    private readonly mailService: MailService
  ) {}

  async login(dto: LoginDto) {
    const role = normalizePortalRole(dto.role) as PortalRole;
    const loginId = (dto.email ?? dto.username ?? "").trim();
    const isProduction = process.env.NODE_ENV === "production";

    // Removed: a login OTP step used to be required for admin/daycare_admin/principal, but it
    // was a single static code shared by every account (LOGIN_OTP, falling back to the public
    // "0000" if unset) -- not per-user, not time-limited, printed in the login page's own demo
    // hint text. It added friction without adding real protection, so it's gone rather than kept
    // as security theater.

    // Hands out a valid admin token for any credentials. Useful locally, catastrophic if the
    // variable ever reaches the deployed environment — so it refuses to run there.
    if (process.env.DEV_AUTH_BYPASS === "true" && isProduction) {
      throw new UnauthorizedException("DEV_AUTH_BYPASS cannot be used in production");
    }

    if (process.env.DEV_AUTH_BYPASS === "true") {
      const tokenPayload = {
        userId: "dev-admin",
        name: "Admin User",
        email: dto.email ?? `${dto.username}@example.com`,
        username: dto.username ?? dto.email?.split("@")[0],
        role
      };

      return {
        message: "Authenticated",
        data: {
          accessToken: this.jwtService.generateAccessToken(tokenPayload),
          refreshToken: this.jwtService.generateRefreshToken(tokenPayload),
          user: {
            id: tokenPayload.userId,
            username: tokenPayload.username,
            name: tokenPayload.name,
            email: tokenPayload.email,
            role,
            designation: "Admin"
          }
        }
      };
    }

    const expectedUserRole = portalRoleToUserRole[role];
    const [user] = await this.databaseService.db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, loginId), eq(usersTable.username, loginId)))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (user.role !== expectedUserRole) {
      throw new UnauthorizedException("Role mismatch");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("User is inactive");
    }

    // Daycare staff are records only (salary, attendance) -- they have no portal of their own.
    if (user.role === "TEACHER") {
      const [teacher] = await this.databaseService.db
        .select({ className: teachersTable.className })
        .from(teachersTable)
        .where(eq(teachersTable.userId, user.id))
        .limit(1);
      if (teacher?.className) {
        const [classRoom] = await this.databaseService.db
          .select({ portal: classesTable.portal })
          .from(classesTable)
          .where(eq(classesTable.name, teacher.className))
          .limit(1);
        const portal = classRoom?.portal ?? classNameToPortal(teacher.className);
        if (portal === "Daycare") {
          throw new UnauthorizedException("Daycare staff do not have portal access");
        }
      }
    }

    const isPasswordValid = await this.hashService.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid password");
    }

    const tokenPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role
    };
    const accessToken = this.jwtService.generateAccessToken(tokenPayload);
    const refreshToken = this.jwtService.generateRefreshToken(tokenPayload);
    await this.persistRefreshToken(user.id, refreshToken);

    const portalUser = await this.toPortalUser(user.id, user.name, user.email, role);

    return {
      message: "Authenticated",
      data: {
        accessToken,
        refreshToken,
        user: {
          ...portalUser,
          username: user.username,
          // Set whenever an Admin/Accountant generates or resets this login's password (see
          // UserService.createUser/generateLogin) -- the frontend's forced-change screen reads
          // this to gate every other page until a real password is set.
          mustChangePassword: user.mustChangePassword
        }
      }
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const refreshToken = this.getRefreshToken(dto);
    const payload = this.jwtService.verifyTypedToken(refreshToken, "refresh").data as {
      userId: string;
      name: string;
      email: string;
      role: PortalRole;
    };

    if (!payload?.userId) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (process.env.DEV_AUTH_BYPASS === "true") {
      const tokenPayload = {
        userId: payload.userId,
        name: payload.name,
        email: payload.email,
        role: payload.role
      };

      return {
        message: "Token refreshed successfully",
        data: {
          accessToken: this.jwtService.generateAccessToken(tokenPayload),
          refreshToken
        }
      };
    }

    const refreshRecord = await this.findValidRefreshToken(payload.userId, refreshToken);
    if (!refreshRecord) {
      throw new UnauthorizedException("Refresh token has been revoked or expired");
    }

    const [user] = await this.databaseService.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("User is inactive or no longer exists");
    }

    const tokenPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: userRoleToPortalRole[user.role]
    };
    const accessToken = this.jwtService.generateAccessToken(tokenPayload);

    return {
      message: "Token refreshed successfully",
      data: { accessToken, refreshToken }
    };
  }

  async logout(dto: LogoutDto) {
    const refreshToken = this.getOptionalRefreshToken(dto);
    if (refreshToken) {
      const payload = this.jwtService.verifyTypedToken(refreshToken, "refresh").data as { userId?: string };
      if (payload?.userId) {
        const refreshRecord = await this.findValidRefreshToken(payload.userId, refreshToken);
        if (refreshRecord) {
          await this.databaseService.db
            .update(refreshTokensTable)
            .set({ revokedAt: new Date(), updatedAt: new Date() })
            .where(eq(refreshTokensTable.id, refreshRecord.id));
        }
      }
    }

    return { message: "Logged out successfully" };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const username = dto.username.trim();
    const email = dto.email.trim();
    const [user] = await this.databaseService.db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.email, email), eq(usersTable.username, username)))
      .limit(1);

    if (user?.status === "ACTIVE") {
      const otp = randomInt(100000, 1000000).toString();
      await this.databaseService.db.insert(passwordResetTokensTable).values({
        userId: user.id,
        otpHash: await this.hashService.hash(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000)
      });
      await this.mailService.sendResetEmail(user.email, user.name, otp);
    }

    return {
      message: "If the username and email match an active account, a password reset OTP has been sent"
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    this.validatePasswordConfirmation(dto.newPassword, dto.confirmNewPassword);
    const loginId = dto.email?.trim() ?? dto.username?.trim();
    if (!loginId) {
      throw new UnauthorizedException("Invalid or expired reset OTP");
    }

    const [user] = await this.databaseService.db
      .select()
      .from(usersTable)
      .where(or(eq(usersTable.email, loginId), eq(usersTable.username, loginId)))
      .limit(1);

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Invalid or expired reset OTP");
    }

    const resetTokens = await this.databaseService.db
      .select()
      .from(passwordResetTokensTable)
      .where(
        and(
          eq(passwordResetTokensTable.userId, user.id),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date())
        )
      )
      .orderBy(desc(passwordResetTokensTable.createdAt));

    const token = await this.findMatchingResetToken(resetTokens, dto.otp);
    if (!token) {
      throw new UnauthorizedException("Invalid or expired reset OTP");
    }

    await this.databaseService.db
      .update(usersTable)
      .set({ password: await this.hashService.hash(dto.newPassword), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    if (token) {
      await this.databaseService.db
        .update(passwordResetTokensTable)
        .set({ usedAt: new Date(), updatedAt: new Date() })
        .where(eq(passwordResetTokensTable.id, token.id));
    }

    await this.revokeAllRefreshTokens(user.id);

    return { message: "Password reset successfully" };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    this.validatePasswordConfirmation(dto.newPassword, dto.confirmNewPassword);
    const [user] = await this.databaseService.db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("User is inactive or no longer exists");
    }

    const isPasswordValid = await this.hashService.compare(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    await this.databaseService.db
      .update(usersTable)
      .set({ password: await this.hashService.hash(dto.newPassword), mustChangePassword: false, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    await this.revokeAllRefreshTokens(user.id);

    return { message: "Password changed successfully" };
  }

  async profile(userId: string) {
    if (process.env.DEV_AUTH_BYPASS === "true") {
      return {
        data: {
          id: userId,
          name: "Admin User",
          email: "admin@example.com",
          role: "admin",
          status: "ACTIVE",
          designation: "Admin"
        }
      };
    }

    const [user] = await this.databaseService.db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        email: usersTable.email,
        role: usersTable.role,
        status: usersTable.status,
        mustChangePassword: usersTable.mustChangePassword,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const portalUser = await this.toPortalUser(user.id, user.name, user.email, userRoleToPortalRole[user.role]);
    return {
      data: {
        ...(user as SafeUser),
        ...portalUser
      }
    };
  }

  private async persistRefreshToken(userId: string, refreshToken: string) {
    await this.databaseService.db.insert(refreshTokensTable).values({
      userId,
      tokenHash: this.hashService.sha256Hex(refreshToken),
      expiresAt: new Date(Date.now() + this.jwtService.refreshTokenMaxAge)
    });
  }

  private getRefreshToken(dto: RefreshTokenDto): string {
    const refreshToken = dto.refreshToken ?? dto.token ?? dto.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    return refreshToken;
  }

  private getOptionalRefreshToken(dto: LogoutDto): string | undefined {
    return dto.refreshToken ?? dto.token ?? dto.refresh_token;
  }

  private validatePasswordConfirmation(newPassword: string, confirmNewPassword?: string) {
    if (confirmNewPassword && confirmNewPassword !== newPassword) {
      throw new UnauthorizedException("Password confirmation does not match");
    }
  }

  private async findValidRefreshToken(userId: string, refreshToken: string) {
    const [record] = await this.databaseService.db
      .select()
      .from(refreshTokensTable)
      .where(
        and(
          eq(refreshTokensTable.userId, userId),
          eq(refreshTokensTable.tokenHash, this.hashService.sha256Hex(refreshToken)),
          isNull(refreshTokensTable.revokedAt),
          gt(refreshTokensTable.expiresAt, new Date())
        )
      )
      .orderBy(desc(refreshTokensTable.createdAt))
      .limit(1);

    return record ?? null;
  }

  private async findMatchingResetToken(tokens: (typeof passwordResetTokensTable.$inferSelect)[], otp: string) {
    for (const token of tokens) {
      if (await this.hashService.compare(otp, token.otpHash)) {
        return token;
      }
    }

    return null;
  }

  private async revokeAllRefreshTokens(userId: string) {
    await this.databaseService.db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(refreshTokensTable.userId, userId), isNull(refreshTokensTable.revokedAt)));
  }

  private async toPortalUser(id: string, name: string, email: string, role: PortalRole) {
    if (role === "teacher") {
      const [teacher] = await this.databaseService.db
        .select()
        .from(teachersTable)
        .where(eq(teachersTable.userId, id))
        .limit(1);

      return {
        id,
        name,
        email,
        role,
        homeroom: teacher?.className
      };
    }

    if (role === "parent") {
      const [parent] = await this.databaseService.db
        .select()
        .from(parentsTable)
        .where(eq(parentsTable.userId, id))
        .limit(1);

      const linkedStudents = parent
        ? await this.databaseService.db
            .select({ id: studentsTable.id })
            .from(studentsTable)
            .where(eq(studentsTable.parentId, parent.id))
        : [];

      return {
        id,
        name,
        email,
        role,
        linkedStudentIds: linkedStudents.map((student) => student.id)
      };
    }

    const [admin] = await this.databaseService.db.select().from(adminsTable).where(eq(adminsTable.userId, id)).limit(1);

    return {
      id,
      name,
      email,
      role,
      designation: role === "principal" ? "Principal" : role === "daycare_admin" ? "Daycare Admin" : admin?.designation
    };
  }
}
