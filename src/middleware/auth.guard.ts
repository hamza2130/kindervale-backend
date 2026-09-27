import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { type Request } from "express";
import { JWTService } from "modules/jwt/jwt.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JWTService) {}

  canActivate(context: ExecutionContext): boolean {
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

    return true;
  }
}
