import { ApiProperty } from "@nestjs/swagger";
import { UserProfileDto } from "../../user/dto/user-profile.dto";
import { CommentDto } from "../../comment/dto/comment.dto";
import { ReactionDto } from "../../reaction/dto/reaction.dto";

export class PostDto {
  @ApiProperty({ example: "60d0fe4f5311236168a109ca" })
  _id: string;

  @ApiProperty({ enum: ["image", "video"], example: "image" })
  type: string;

  @ApiProperty({ example: "https://example.com/image.jpg" })
  mediaUrl: string;

  @ApiProperty({
    example: "https://example.com/thumb.jpg",
    required: false,
  })
  thumbnailUrl?: string;

  @ApiProperty({ example: "My awesome post!", required: false })
  caption?: string;

  @ApiProperty({ type: () => UserProfileDto })
  userId: UserProfileDto;

  @ApiProperty({ type: [ReactionDto] })
  reactions: ReactionDto[];

  @ApiProperty({ type: [CommentDto] })
  comments: CommentDto[];

  @ApiProperty({ enum: ['public', 'private'], example: 'public' })
  visibility: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
