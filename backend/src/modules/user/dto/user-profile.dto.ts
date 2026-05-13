import { ApiProperty } from "@nestjs/swagger";

export class UserProfileDto {
  @ApiProperty({
    example: "60d0fe4f5311236168a109ca",
    description: "The unique identifier of the user",
  })
  _id: string;

  @ApiProperty({
    example: "John Doe",
    description: "The name of the user",
  })
  name: string;

  @ApiProperty({
    example: "john.doe@example.com",
    description: "The email of the user",
  })
  email: string;

  @ApiProperty({
    example: "https://example.com/avatar.png",
    description: "URL of the user's avatar",
    required: false,
  })
  avatar?: string;

  @ApiProperty({
    example: "Hello, I love photography!",
    description: "Short bio",
    required: false,
  })
  bio?: string;

  @ApiProperty({
    example: "2023-01-01T00:00:00.000Z",
    description: "The date when the user was created",
  })
  createdAt: Date;

  @ApiProperty({
    example: "2023-01-01T00:00:00.000Z",
    description: "The date when the user was last updated",
  })
  updatedAt: Date;
}
