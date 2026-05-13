import { ApiProperty } from "@nestjs/swagger";

export class MessageDto {
  @ApiProperty({ example: "65f0fe4f5311236168a109d0" })
  _id: string;

  @ApiProperty({ example: "65f0fe4f5311236168a109cd" })
  conversationId: string;

  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  senderId: string;

  @ApiProperty({ enum: ["text", "image", "video"], example: "text" })
  type: "text" | "image" | "video";

  @ApiProperty({
    example: "Hey, what's up?",
    required: false,
    description: "Required when type is 'text'",
  })
  content?: string;

  @ApiProperty({
    example: "/uploads/abc123.jpg",
    required: false,
    description: "Required when type is 'image' or 'video'",
  })
  mediaUrl?: string;

  @ApiProperty({
    isArray: true,
    type: String,
    example: ["60d0fe4f5311236168a109ca"],
    description: "userIds that have read this message (includes sender)",
  })
  readBy: string[];

  @ApiProperty({ example: "2025-05-11T08:32:10.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2025-05-11T08:32:10.000Z" })
  updatedAt: Date;
}
