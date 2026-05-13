import { ApiProperty } from "@nestjs/swagger";

export class AccessTokenResponseDto {
  @ApiProperty({
    description: "A new JSON Web Token for authentication",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;
}
