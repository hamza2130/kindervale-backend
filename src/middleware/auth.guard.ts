import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq } from "drizzle-orm";
import { type Request } from "express";
import { SKIP_ACCOUNT_STATE_KEY } from "middleware/account-state.decorator";
import { DatabaseService } from "modules/database/database.service";
import { JWTService } from "modules/jwt/jwt.service";
import usersTable from "models/users";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JWTService,
    private readonly reflector: Reflector,
    private readonly databaseService: DatabaseService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request & { user?: unknown } = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!accessToken) {
      throw new UnauthorizedException("Access token not found");
    }

    const payload = this.jwtService.verifyTypedToken(accessToken, "access");
    if (!payload.data) {
      throw new UnauthorizedException("Invalid token payload");
    }

    request.user = payload.data;
    if (!request.user) {
      throw new UnauthorizedException("Invalid token payload");
    }

    // The token itself only proves who the caller was *at login* -- it carries no live account
    // state, so a deactivated user keeps working with it for the rest of its ~15 min lifetime,
    // and a server-generated password that was never rotated was never actually enforced server
    // side (only the frontend's own forced-change screen gated it; a direct API caller could skip
    // straight past). One indexed lookup per request is the cost of actually checking both.
    const userId = (request.user as { userId?: string }).userId;
    if (userId) {
      const [account] = await this.databaseService.db
        .select({ status: usersTable.status, mustChangePassword: usersTable.mustChangePassword })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      if (!account || account.status !== "ACTIVE") {
        throw new UnauthorizedException("Account is inactive");
      }
      const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ACCOUNT_STATE_KEY, [context.getHandler(), context.getClass()]);
      if (account.mustChangePassword && !skip) {
        throw new ForbiddenException("Password must be changed before continuing");
      }
    }

    return true;
  }
}
