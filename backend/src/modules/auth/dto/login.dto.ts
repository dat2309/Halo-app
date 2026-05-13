import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: "user@example.com or 0123456789",
    description: "User email or phone number"
  })
  @IsString()
  identifier: string;

  @ApiProperty({
    example: "password123",
    description: "User password (min 6 characters)",
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}

