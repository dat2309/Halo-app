import { IsOptional, IsEnum } from "class-validator";

export class CreateReactionDto {
  @IsOptional()
  @IsEnum(["like", "love", "laugh", "wow", "sad", "angry"])
  type?: string;
}

