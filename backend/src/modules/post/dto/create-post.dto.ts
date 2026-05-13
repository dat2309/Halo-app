import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";

export class CreatePostDto {
  @ApiProperty({
    enum: ["image", "video"],
    example: "image",
    description: "Post type",
  })
  @IsEnum(["image", "video"])
  type: string;

  @ApiProperty({
    example: "https://example.com/image.jpg",
    description: "Media URL",
  })
  @IsString()
  mediaUrl: string;

  @ApiProperty({
    example: "https://example.com/thumb.jpg",
    description: "Thumbnail URL (optional)",
    required: false,
  })
  @IsOptional()
  @IsUrl()
  thumbnailUrl?: string;

  @ApiProperty({
    example: "My awesome post!",
    description: "Post caption (optional)",
    required: false,
  })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({
    enum: ["public", "private"],
    example: "public",
    description: "Post visibility (default: public)",
    required: false,
  })
  @IsOptional()
  @IsEnum(["public", "private"])
  visibility?: string;
}
