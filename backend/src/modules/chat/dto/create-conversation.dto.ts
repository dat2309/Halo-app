import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId } from "class-validator";

export class CreateConversationDto {
  @ApiProperty({
    description:
      "userId of the other participant. Must be a valid MongoDB ObjectId.",
    example: "60d0fe4f5311236168a109cb",
  })
  @IsMongoId()
  peerId: string;
}
