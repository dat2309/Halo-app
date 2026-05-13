import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import {
  PaginatedResponseDto,
  SuccessResponseDto,
} from "../../common/responses/api-response.dto";
import { SuccessMessageDto } from "../../common/responses/success-message.dto";
import { CreatePostDto } from "./dto/create-post.dto";
import { PostDto } from "./dto/post.dto";
import { PostService } from "./post.service";

@ApiTags("Posts")
@ApiBearerAuth("JWT-auth")
@Controller("posts")
export class PostController {
  constructor(private postService: PostService) { }

  @Post()
  @ApiOperation({ summary: "Create a new post" })
  @ApiResponse({
    status: 201,
    description: "Post created successfully",
    type: SuccessResponseDto(PostDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async create(@Request() req, @Body() createPostDto: CreatePostDto) {
    const post = await this.postService.create(
      req.user.userId,
      createPostDto.type,
      createPostDto.mediaUrl,
      createPostDto.thumbnailUrl,
      createPostDto.caption,
      createPostDto.visibility
    );
    const populatedPost = await this.postService.findById(post._id.toString());
    return {
      success: true,
      data: populatedPost,
      message: "Post created successfully",
    };
  }

  @Get()
  @ApiOperation({ summary: "Get all posts (paginated)" })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number for pagination",
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Number of items per page",
    type: Number,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "Posts retrieved successfully",
    type: PaginatedResponseDto(PostDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async findAll(
    @Request() req,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    const result = await this.postService.findAll(req.user.userId, page, limit);
    return {
      success: true,
      data: result,
    };
  }

  @Get("discover")
  @ApiOperation({ summary: "Discover posts from all users" })
  @ApiQuery({ name: "q", required: false, description: "Search caption" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Discover posts" })
  async discover(
    @Query("q") q: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    const result = await this.postService.discover(q, page, limit);
    return { success: true, data: result };
  }

  @Get("user/:userId")
  @ApiOperation({ summary: "Get posts by a specific user" })
  @ApiParam({ name: "userId", description: "The user ID" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "User posts" })
  async findByUser(
    @Request() req,
    @Param("userId") userId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    const result = await this.postService.findByUserIdPaginated(userId, page, limit, req.user.userId);
    return { success: true, data: result };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get post by ID" })
  @ApiParam({ name: "id", description: "The ID of the post", type: String })
  @ApiResponse({
    status: 200,
    description: "Post retrieved successfully",
    type: SuccessResponseDto(PostDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async findOne(@Request() req, @Param("id") id: string) {
    const post = await this.postService.findById(id);
    if (!post) {
      throw new NotFoundException("Post not found");
    }
    if (post.visibility === 'private' && post.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("This post is private");
    }
    return {
      success: true,
      data: post,
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete post" })
  @ApiParam({ name: "id", description: "The ID of the post", type: String })
  @ApiResponse({
    status: 200,
    description: "Post deleted successfully",
    type: SuccessMessageDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not the owner" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async delete(@Request() req, @Param("id") id: string) {
    const post = await this.postService.findById(id);
    if (!post) {
      throw new NotFoundException("Post not found");
    }
    if (post.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only delete your own posts");
    }
    await this.postService.delete(id, req.user.userId);
    return {
      success: true,
      message: "Post deleted successfully",
    };
  }
}
