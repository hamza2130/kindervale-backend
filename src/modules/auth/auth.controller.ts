import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { User } from "middleware/user.decorator";
import { AuthGuard } from "middleware/auth.guard";
import { SkipAccountStateCheck } from "middleware/account-state.decorator";
import { AuthService } from "modules/auth/auth.service";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
  ResetPasswordDto
} from "modules/auth/auth.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  @Post("refresh")
  async refresh(@Body() dto: RefreshTokenDto) {
    return await this.authService.refresh(dto);
  }

  @Post("logout")
  async logout(@Body() dto: LogoutDto) {
    return await this.authService.logout(dto);
  }

  @Post("forgot-password")
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return await this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return await this.authService.resetPassword(dto);
  }

  @SkipAccountStateCheck()
  @UseGuards(AuthGuard)
  @Patch("change-password")
  async changePassword(@User("userId") userId: string, @Body() dto: ChangePasswordDto) {
    return await this.authService.changePassword(userId, dto);
  }

  @SkipAccountStateCheck()
  @UseGuards(AuthGuard)
  @Get("profile")
  async profile(@User("userId") userId: string) {
    return await this.authService.profile(userId);
  }
}
