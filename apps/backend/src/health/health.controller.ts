import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../database/prisma.service.js";
import { RedisService } from "../database/redis.service.js";

class HealthStatusDto {
  @ApiProperty({ example: "ok", enum: ["ok"] })
  status!: "ok";
}

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Проверить, что процесс HTTP API запущен" })
  @ApiOkResponse({ type: HealthStatusDto })
  live(): HealthStatusDto {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOperation({ summary: "Проверить готовность критичных зависимостей" })
  @ApiOkResponse({ type: HealthStatusDto })
  async ready(): Promise<HealthStatusDto> {
    const results = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    if (results.some((result) => result.status === "rejected")) {
      throw new ServiceUnavailableException("Критичные зависимости пока недоступны");
    }

    return { status: "ok" };
  }
}
