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
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiExtraModels,
} from "@nestjs/swagger";
import { SuccessResponseDto } from "../../common/responses/api-response.dto";
import { SuccessMessageDto } from "../../common/responses/success-message.dto";
import { ChatService } from "./chat.service";
import { ChatParticipantDto } from "./dto/chat-participant.dto";
import { ConversationDto } from "./dto/conversation.dto";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { MessageDto } from "./dto/message.dto";
import { MessagesPageDto } from "./dto/messages-page.dto";

@ApiTags("Chat")
@ApiBearerAuth("JWT-auth")
@ApiExtraModels(ChatParticipantDto, MessageDto)
@Controller("chat")
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get("conversations")
  @ApiOperation({
    summary: "List all conversations of current user",
    description:
      "Returns conversations sorted by latest activity. Each conversation includes participants, last message preview, and unread count for the current user.",
  })
  @ApiResponse({
    status: 200,
    description: "Conversations retrieved successfully",
    type: SuccessResponseDto(ConversationDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async list(@Request() req) {
    const data = await this.chatService.listConversations(req.user.userId);
    return { success: true, data };
  }

  @Post("conversations")
  @ApiOperation({
    summary: "Get or create a 1-1 conversation with peer",
    description:
      "Idempotent: returns the existing conversation if one already exists between the requesting user and the peer. Otherwise creates a new one.",
  })
  @ApiBody({ type: CreateConversationDto })
  @ApiResponse({
    status: 201,
    description: "Conversation found or created",
    type: SuccessResponseDto(ConversationDto),
  })
  @ApiResponse({ status: 400, description: "Bad Request — invalid peerId" })
  @ApiResponse({
    status: 403,
    description: "Forbidden — cannot start a conversation with yourself",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async createOrGet(@Request() req, @Body() dto: CreateConversationDto) {
    const conv = await this.chatService.getOrCreateConversation(
      req.user.userId,
      dto.peerId
    );
    return { success: true, data: conv };
  }

  @Get("conversations/:id/messages")
  @ApiOperation({
    summary: "Paginated message history (cursor-based)",
    description:
      "Returns messages sorted descending by _id (newest first). Use `nextCursor` from the response as the `cursor` query for the next request. Stops when `nextCursor` is null.",
  })
  @ApiParam({ name: "id", description: "Conversation ID" })
  @ApiQuery({
    name: "cursor",
    required: false,
    type: String,
    description: "Message _id from previous response's `nextCursor` field",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Max messages per page (default 30)",
  })
  @ApiResponse({
    status: 200,
    description: "Messages retrieved successfully",
    type: SuccessResponseDto(MessagesPageDto),
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden — not a member of this conversation",
  })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async messages(
    @Request() req,
    @Param("id") id: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(30), ParseIntPipe) limit?: number
  ) {
    const data = await this.chatService.getMessages(
      id,
      req.user.userId,
      cursor,
      limit
    );
    return { success: true, data };
  }

  @Post("conversations/:id/read")
  @ApiOperation({
    summary: "Mark conversation as read for current user",
    description:
      "Resets unreadCount to 0 and adds current user to readBy of all messages. Also emits a `chat:read` socket event to other participants.",
  })
  @ApiParam({ name: "id", description: "Conversation ID" })
  @ApiResponse({
    status: 200,
    description: "Marked as read successfully",
    type: SuccessMessageDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden — not a member of this conversation",
  })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async markRead(@Request() req, @Param("id") id: string) {
    await this.chatService.markRead(id, req.user.userId);
    return { success: true, message: "Conversation marked as read" };
  }
}
