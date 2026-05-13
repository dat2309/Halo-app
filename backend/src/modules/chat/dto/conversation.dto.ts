import { ApiProperty } from "@nestjs/swagger";
import { ChatParticipantDto } from "./chat-participant.dto";

export class ConversationDto {
  @ApiProperty({ example: "65f0fe4f5311236168a109cd" })
  _id: string;

  @ApiProperty({
    isArray: true,
    type: ChatParticipantDto,
    description: "Both participants (always 2 for 1-1 chat)",
  })
  participants: ChatParticipantDto[];

  @ApiProperty({
    example: "Hey, what's up?",
    required: false,
    description: "Preview of the latest message (or '[image]' / '[video]')",
  })
  lastMessage?: string;

  @ApiProperty({
    enum: ["text", "image", "video"],
    required: false,
    example: "text",
  })
  lastMessageType?: "text" | "image" | "video";

  @ApiProperty({
    example: "2025-05-11T08:32:10.000Z",
    required: false,
    description: "ISO timestamp of the last message",
  })
  lastMessageAt?: Date;

  @ApiProperty({
    example: "60d0fe4f5311236168a109ca",
    required: false,
    description: "userId of the last message sender",
  })
  lastMessageSenderId?: string;

  @ApiProperty({
    example: 3,
    description: "Unread message count for the requesting user",
  })
  unreadCount: number;

  @ApiProperty({ example: "2025-05-11T08:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2025-05-11T08:32:10.000Z" })
  updatedAt: Date;
}
