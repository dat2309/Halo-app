import { ApiProperty } from "@nestjs/swagger";
import { UserProfileDto } from "../../user/dto/user-profile.dto";

export class CommentDto {
  @ApiProperty({ example: "60d0fe4f5311236168a109cb" })
  _id: string;

  @ApiProperty({ example: "Great post!" })
  content: string;

  @ApiProperty({ type: () => UserProfileDto })
  userId: UserProfileDto;

  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  postId: string;

  @ApiProperty({ example: "60d0fe4f5311236168a109cc", required: false })
  parentId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
