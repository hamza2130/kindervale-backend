import { Injectable, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign, verify, TokenExpiredError, type JwtPayload, type SignOptions } from "jsonwebtoken";

@Injectable()
export class JWTService {
  private readonly secret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  readonly accessTokenMaxAge: number;
  readonly refreshTokenMaxAge: number;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.getOrThrow<string>("JWT_SECRET");
    this.accessTokenExpiry = this.configService.get<string>("JWT_EXPIRE_TIME") ?? "15m";
    this.refreshTokenExpiry = this.configService.get<string>("JWT_REFRESH_EXPIRE_TIME") ?? "7d";

    this.accessTokenMaxAge = this.parseExpiryToMilliseconds(this.accessTokenExpiry);
    this.refreshTokenMaxAge = this.parseExpiryToMilliseconds(this.refreshTokenExpiry);
  }

  private parseExpiryToMilliseconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new InternalServerErrorException(`Invalid expiry format: ${expiry}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new InternalServerErrorException(`Invalid expiry unit: ${unit}`);
    }
  }

  generateAccessToken(data: object): string {
    return sign({ data, typ: "access" }, this.secret, {
      expiresIn: this.accessTokenExpiry
    } as SignOptions);
  }

  generateRefreshToken(data: object): string {
    return sign({ data, typ: "refresh" }, this.secret, {
      expiresIn: this.refreshTokenExpiry
    } as SignOptions);
  }

  verifyToken(token: string): JwtPayload {
    try {
      return verify(token, this.secret) as JwtPayload;
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw new UnauthorizedException("Token has expired");
      }
      throw new UnauthorizedException("Invalid token");
    }
  }

  /** Verifies the token AND that it was issued as the expected kind, so an access token can't
   *  be replayed as a refresh token (or vice versa) even though both are valid, signed JWTs. */
  verifyTypedToken(token: string, expectedType: "access" | "refresh"): JwtPayload {
    const payload = this.verifyToken(token);
    if (payload.typ !== expectedType) {
      throw new UnauthorizedException("Invalid token type");
    }
    return payload;
  }
}
