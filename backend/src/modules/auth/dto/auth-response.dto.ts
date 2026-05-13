import { ApiProperty } from "@nestjs/swagger";
import { UserProfileDto } from "../../user/dto/user-profile.dto";

export class AuthResponseDto {
  @ApiProperty({
    description: "The authenticated user's profile",
    type: UserProfileDto,
  })
  user: UserProfileDto;

  @ApiProperty({
    description: "JSON Web Token for authentication",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;

  @ApiProperty({
    description: "Token used to refresh the access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  refreshToken: string;
}
