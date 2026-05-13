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
import { CommentService } from "./comment.service";
import { CommentDto } from "./dto/comment.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { SocketGateway } from "../socket/socket.gateway";

@ApiTags("Comments")
@ApiBearerAuth("JWT-auth")
@Controller("posts/:postId/comments")
@ApiParam({ name: "postId", description: "The ID of the post", type: String })
export class CommentController {
  constructor(
    private commentService: CommentService,
    private socketGateway: SocketGateway
  ) { }

  @Post()
  @ApiOperation({ summary: "Create a new comment on a post" })
  @ApiResponse({
    status: 201,
    description: "Comment created successfully",
    type: SuccessResponseDto(CommentDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async create(
    @Param("postId") postId: string,
    @Request() req,
    @Body() createCommentDto: CreateCommentDto
  ) {
    const { comment, commentCount } = await this.commentService.create(
      postId,
      req.user.userId,
      createCommentDto.content,
      createCommentDto.parentId
    );
    const populatedComment = await this.commentService.findById(
      comment._id.toString()
    );

    this.socketGateway.emitCommentUpdated(postId, {
      action: "create",
      commentCount,
    });

    return {
      success: true,
      data: populatedComment,
      message: "Comment created successfully",
    };
  }

  @Get()
  @ApiOperation({ summary: "Get all comments for a post (paginated)" })
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
    description: "Comments retrieved successfully",
    type: PaginatedResponseDto(CommentDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async findAll(
    @Param("postId") postId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    const result = await this.commentService.findByPostId(postId, page, limit);
    return {
      success: true,
      data: result,
    };
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a comment" })
  @ApiParam({
    name: "id",
    description: "The ID of the comment to delete",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Comment deleted successfully",
    type: SuccessMessageDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Not the owner" })
  @ApiResponse({ status: 404, description: "Comment or Post not found" })
  async delete(
    @Request() req,
    @Param("postId") postId: string,
    @Param("id") id: string
  ) {
    const comment = await this.commentService.findById(id);
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }
    if (comment.userId.toString() !== req.user.userId) {
      throw new ForbiddenException("You can only delete your own comments");
    }
    const newCount = await this.commentService.delete(id, postId, req.user.userId);

    this.socketGateway.emitCommentUpdated(postId, {
      action: "delete",
      commentCount: newCount,
    });
    return {
      success: true,
      message: "Comment deleted successfully",
    };
  }
}

