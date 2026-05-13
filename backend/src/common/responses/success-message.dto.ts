import { ApiProperty } from "@nestjs/swagger";

export class SuccessMessageDto {
  @ApiProperty({
    type: "boolean",
    description: "Indicates if the request was successful.",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    type: "string",
    description: "A message indicating the result of the operation.",
    example: "Operation completed successfully",
  })
  message: string;
}
