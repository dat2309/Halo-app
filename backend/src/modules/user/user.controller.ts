import { Controller, Get, Patch, Body, Request } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UserService } from "./user.service";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserProfileDto } from "./dto/user-profile.dto";
import { SuccessResponseDto } from "../../common/responses/api-response.dto";

@ApiTags("User")
@ApiBearerAuth("JWT-auth")
@Controller("user")
export class UserController {
  constructor(private userService: UserService) {}

  @Get("profile")
  @ApiOperation({ summary: "Get user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile retrieved successfully",
    type: SuccessResponseDto(UserProfileDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getProfile(@Request() req) {
    const user = await this.userService.findById(req.user.userId);
    const { password, ...result } = user.toObject();
    return {
      success: true,
      data: result,
    };
  }

  @Patch("profile")
  @ApiOperation({ summary: "Update user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    type: SuccessResponseDto(UserProfileDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async updateProfile(
    @Request() req,
    @Body() updateData: UpdateUserDto
  ) {
    const user = await this.userService.update(req.user.userId, updateData);
    const { password, ...result } = user.toObject();
    return {
      success: true,
      data: result,
    };
  }
}

