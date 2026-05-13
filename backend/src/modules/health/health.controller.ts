import { Controller, Get } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
} from "@nestjs/swagger";
import {
  HealthCheckService,
  HealthCheck,
  MongooseHealthIndicator,
} from "@nestjs/terminus";
import { Public } from "../../common/decorators/public.decorator";
import { HealthCheckResponseDto } from "./dto/health-check-response.dto";

@ApiTags("Health")
@Controller("health")
@Public()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: MongooseHealthIndicator
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: "Check the health of the service" })
  @ApiResponse({
    status: 200,
    description: "Service is healthy",
    type: HealthCheckResponseDto,
  })
  @ApiResponse({ status: 503, description: "Service is unhealthy" })
  check() {
    return this.health.check([() => this.db.pingCheck("mongodb")]);
  }
}

