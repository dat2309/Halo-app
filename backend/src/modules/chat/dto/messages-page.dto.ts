import { ApiProperty } from "@nestjs/swagger";
import { MessageDto } from "./message.dto";

export class MessagesPageDto {
  @ApiProperty({
    isArray: true,
    type: MessageDto,
    description: "Messages sorted descending by _id (newest first)",
  })
  list: MessageDto[];

  @ApiProperty({
    example: "65f0fe4f5311236168a109d0",
    nullable: true,
    description:
      "Cursor for fetching the next (older) page. null when no more pages.",
  })
  nextCursor: string | null;

  @ApiProperty({ example: 30 })
  limit: number;
}
