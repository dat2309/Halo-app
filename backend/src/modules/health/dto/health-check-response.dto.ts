import { ApiProperty } from "@nestjs/swagger";

class HealthCheckDetails {
  @ApiProperty({ example: "up" })
  status: string;
}

export class HealthCheckResponseDto {
  @ApiProperty({ example: "ok" })
  status: string;

  @ApiProperty({
    type: "object",
    properties: {
      mongodb: { $ref: "#/components/schemas/HealthCheckDetails" },
    },
  })
  info: {
    mongodb: HealthCheckDetails;
  };

  @ApiProperty({
    type: "object",
  })
  error: object;

  @ApiProperty({
    type: "object",
    properties: {
      mongodb: { $ref: "#/components/schemas/HealthCheckDetails" },
    },
  })
  details: {
    mongodb: HealthCheckDetails;
  };
}
