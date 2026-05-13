import { ApiProperty } from "@nestjs/swagger";
import { UserProfileDto } from "../../user/dto/user-profile.dto";

export class ReactionDto {
  @ApiProperty({ example: "60d0fe4f5311236168a109cc" })
  _id: string;

  @ApiProperty({
    enum: ["like", "love", "laugh", "wow", "sad", "angry"],
    example: "like",
  })
  type: string;

  @ApiProperty({ type: () => UserProfileDto })
  userId: UserProfileDto;

  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  postId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
