import { Type } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";

export function SuccessResponseDto<TData>(dataType: Type<TData>) {
  abstract class SuccessResponse {
    @ApiProperty({
      type: "boolean",
      description: "Indicates if the request was successful.",
      example: true,
    })
    success: boolean;

    @ApiProperty({
      type: dataType,
      description: "The data payload of the response.",
    })
    data: TData;
  }

  return SuccessResponse;
}

export function PaginatedResponseDto<TData>(dataType: Type<TData>) {
  abstract class PaginatedResponse {
    @ApiProperty({
      type: "boolean",
      description: "Indicates if the request was successful.",
      example: true,
    })
    success: boolean;

    @ApiProperty({
      isArray: true,
      type: dataType,
      description: "The data payload of the response.",
    })
    list: TData[];

    @ApiProperty({
      type: "number",
      description: "Total number of items.",
      example: 100,
    })
    total: number;

    @ApiProperty({
      type: "number",
      description: "Current page number.",
      example: 1,
    })
    page: number;

    @ApiProperty({
      type: "number",
      description: "Number of items per page.",
      example: 10,
    })
    limit: number;
  }
  return PaginatedResponse;
}
