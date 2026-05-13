import { IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCommentDto {
  @ApiProperty({ example: "Great post!", description: "Comment content" })
  @IsString()
  @MinLength(1)
  content: string;

  @ApiProperty({ example: "60d0fe4f5311236168a109cc", required: false, description: "Parent comment ID for replies" })
  @IsString()
  @IsOptional()
  parentId?: string;
}

