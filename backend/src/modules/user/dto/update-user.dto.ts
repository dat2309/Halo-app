import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateUserDto {
  @ApiProperty({
    example: "John Doe",
    description: "The name of the user",
    required: false,
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: "https://example.com/avatar.png",
    description: "URL of the user's avatar",
    required: false,
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    example: "Hello, I love photography!",
    description: "Short bio (max 160 characters)",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  bio?: string;
}
