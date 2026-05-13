import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserService } from "./user.service";

@ApiTags("User Lookup")
@Controller("users")
export class LookupController {
  constructor(private userService: UserService) {}

  @Get("lookup")
  @ApiOperation({ summary: "Find a user by exact username" })
  @ApiResponse({ status: 200, description: "User found" })
  @ApiResponse({ status: 404, description: "User not found" })
  async lookup(@Query("username") username: string) {
    const user = await this.userService.findByUsername(username);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return {
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
      },
    };
  }

  @Get("search")
  @ApiOperation({ summary: "Search users by name or username" })
  @ApiQuery({ name: "q", required: true, description: "Search query" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Search results" })
  async search(
    @Query("q") q: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
    if (!q || q.trim().length === 0) {
      return { success: true, data: { list: [], total: 0, page, limit } };
    }
    const result = await this.userService.searchUsers(q.trim(), page, limit);
    return { success: true, data: result };
  }

  @Get(":id/profile")
  @ApiOperation({ summary: "Get public profile by user ID" })
  @ApiResponse({ status: 200, description: "Public profile" })
  @ApiResponse({ status: 404, description: "User not found" })
  async publicProfile(@Param("id") id: string) {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return {
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        createdAt: user.createdAt,
      },
    };
  }
}
