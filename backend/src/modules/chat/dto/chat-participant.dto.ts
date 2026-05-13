import { ApiProperty } from "@nestjs/swagger";

export class ChatParticipantDto {
  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  _id: string;

  @ApiProperty({ example: "Nguyen Van A", required: false })
  name?: string;

  @ApiProperty({ example: "vanha", required: false })
  username?: string;

  @ApiProperty({
    example: "/uploads/avatars/abc.jpg",
    required: false,
    description: "Relative path or absolute URL of avatar",
  })
  avatar?: string;
}
