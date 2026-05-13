import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

/**
 * Payload for the `chat:send` socket event.
 *
 * Note: this is documented as a DTO so clients can see the expected shape via
 * Swagger, but messages are sent over Socket.IO, not HTTP. There is no REST
 * endpoint that consumes this DTO directly.
 */
export class SendMessageDto {
  @ApiProperty({
    enum: ["text", "image", "video"],
    default: "text",
    required: false,
    description: "Type of message. Defaults to 'text' if omitted.",
  })
  @IsOptional()
  @IsEnum(["text", "image", "video"])
  type?: "text" | "image" | "video";

  @ApiProperty({
    required: false,
    example: "Hello!",
    description:
      "Required when type is 'text'. Max 2000 chars. Either `content` or `mediaUrl` must be present.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @ApiProperty({
    required: false,
    example: "/uploads/abc123.jpg",
    description:
      "Required when type is 'image' or 'video'. Should be the URL returned by POST /upload.",
  })
  @IsOptional()
  @IsString()
  mediaUrl?: string;
}
