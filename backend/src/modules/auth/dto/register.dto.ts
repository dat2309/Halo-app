import { IsEmail, IsString, MinLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "user@example.com", description: "User email" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "0123456789", description: "Phone number (10 digits, starts with 0)" })
  @IsString()
  @Matches(/^0\d{9}$/, { message: 'Phone must be 10 digits and start with 0' })
  phone: string;

  @ApiProperty({ example: "password123", description: "User password (min 6 characters)", minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: "John Doe", description: "User full name" })
  @IsString()
  name: string;

  @ApiProperty({ example: "johndoe", description: "Unique username" })
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers and underscores' })
  username: string;
}

