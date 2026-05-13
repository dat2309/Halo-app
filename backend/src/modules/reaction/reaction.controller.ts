import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
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
import { CreateReactionDto } from "./dto/create-reaction.dto";
import { ReactionDto } from "./dto/reaction.dto";
import { ToggleReactionResponseDto } from "./dto/toggle-reaction-response.dto";
import { ReactionService } from "./reaction.service";
import { SocketGateway } from "../socket/socket.gateway";
import { PostService } from "../post/post.service";

@ApiTags("Reactions")
@ApiBearerAuth("JWT-auth")
@Controller("posts/:postId/reactions")
@ApiParam({ name: "postId", description: "The ID of the post", type: String })
export class ReactionController {
  constructor(
    private reactionService: ReactionService,
    private socketGateway: SocketGateway,
    private postService: PostService
  ) { }

  @Post()
  @ApiOperation({
    summary: "Toggle a reaction on a post",
    description:
      "Adds a reaction if it doesn't exist, or removes it if it does.",
  })
  @ApiResponse({
    status: 201,
    description: "The reaction was successfully toggled.",
    type: SuccessResponseDto(ToggleReactionResponseDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async toggleReaction(
    @Param("postId") postId: string,
    @Request() req,
    @Body() createReactionDto: CreateReactionDto
  ) {
    const result = await this.reactionService.toggleReaction(
      postId,
      req.user.userId,
      createReactionDto.type || "like"
    );

    // Fetch updated post to get the new reactionCount
    const updatedPost = await this.postService.findById(postId);

    // Emit real-time update with more context
    this.socketGateway.emitReactionUpdated(postId, {
      action: result.isNew ? "added" : "removed",
      reaction: result.reaction,
      reactionCount: updatedPost?.reactionCount || 0,
    });

    const populatedReaction = result.reaction
      ? await this.reactionService.checkUserReaction(postId, req.user.userId)
      : null;

    return {
      success: true,
      data: {
        action: result.isNew ? "added" : "removed",
        reaction: populatedReaction,
      },
    };
  }

  @Get()
  @ApiOperation({ summary: "Get all reactions for a post (paginated)" })
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
    description: "Reactions retrieved successfully",
    type: PaginatedResponseDto(ReactionDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Post not found" })
  async findAll(
    @Param("postId") postId: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    const result = await this.reactionService.findByPostId(postId, page, limit);
    return {
      success: true,
      data: result,
    };
  }
}

