import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { SuccessResponseDto } from "../../common/responses/api-response.dto";
import { UserProfileDto } from "../user/dto/user-profile.dto";
import { AuthService } from "./auth.service";
import { AccessTokenResponseDto } from "./dto/access-token-response.dto";
import { AuthResponseDto } from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post("register")
  @Public()
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({
    status: 201,
    description: "User registered successfully",
    type: SuccessResponseDto(AuthResponseDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request (e.g., email already exists)" })
  async register(@Body() registerDto: RegisterDto) {
    const result = await this.authService.register(
      registerDto.email,
      registerDto.password,
      registerDto.name,
      registerDto.phone,
      registerDto.username
    );
    return {
      success: true,
      data: result,
      message: "User registered successfully",
    };
  }

  @Post("login")
  @Public()
  @UseGuards(LocalAuthGuard)
  @ApiBody({ type: LoginDto })
  @ApiOperation({ summary: "Login user" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
    type: SuccessResponseDto(AuthResponseDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async login(@Request() req, @Body() _loginDto: LoginDto) {
    const result = await this.authService.login(req.user);
    return {
      success: true,
      data: result,
      message: "Login successful",
    };
  }

  @Post("refresh")
  @Public()
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    type: SuccessResponseDto(AccessTokenResponseDto),
  })
  @ApiResponse({ status: 401, description: "Invalid refresh token" })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshToken(
      refreshTokenDto.refreshToken
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get("me")
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "User profile retrieved successfully",
    type: SuccessResponseDto(UserProfileDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Request() req) {
    return {
      success: true,
      data: req.user,
    };
  }
}
